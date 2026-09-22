import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import type { CollectionConfig } from '~/config/config';
import type { MqttBridgeClient } from './mqtt/mqtt.service';
import { MqttService } from './mqtt/mqtt.service';
import type { PocketBaseEvent, PocketBaseRecord } from './pocketbase/pocketbase.service';
import { PocketBaseService } from './pocketbase/pocketbase.service';

const collections: CollectionConfig[] = [
  { collection: 'events', payload: 'both', publish: 'events', topic: 'home/events' },
  { collection: 'latest', payload: 'both', publish: 'latest', topic: 'home/latest' },
  {
    collection: 'grouped',
    filter: 'type = "1m"',
    groupBy: 'system',
    payload: 'both',
    publish: 'latest',
    sort: '-created,-id',
    topic: 'home/grouped',
  },
  { collection: 'records', payload: 'both', publish: 'records', topic: 'home/records' },
];

jest.mock('~/config/env', () => ({
  ENV: {
    MQTT_CLIENT_ID: '',
    MQTT_HOST: 'mqtt.test',
    MQTT_PORT: 1883,
    MQTT_PROTOCOL: 'mqtt',
    POCKETBASE_AUTH_COLLECTION: 'users',
    POCKETBASE_PASSWORD: 'test-password',
    POCKETBASE_URL: 'https://pocketbase.test',
    POCKETBASE_USERNAME: 'bridge',
  },
}));

jest.mock('~/config/config', () => ({ CONFIG: { collections } }));

jest.mock('./pocketbase/pocketbase.service', () => ({ PocketBaseService: class PocketBaseService {} }));

import { BridgeService } from './bridge.service';

function record(id: string, updated: string): PocketBaseRecord {
  return { collectionId: 'collection', collectionName: 'test', created: updated, id, updated, value: id };
}

function createMqtt() {
  return {
    publish: jest.fn(),
    subscribe: jest.fn<ReturnType<MqttBridgeClient['subscribe']>, Parameters<MqttBridgeClient['subscribe']>>(
      () => () => undefined,
    ),
  };
}

function createPocketBase() {
  const eventHandlers = new Map<string, (event: PocketBaseEvent) => void>();
  let connectHandler: (() => void) | undefined;
  return {
    getConnectHandler: () => connectHandler,
    eventHandlers,
    latest: jest.fn(async () => record('latest-id', '2026-01-02 00:00:00.000Z')),
    list: jest.fn(async (collection: string) =>
      collection === 'grouped'
        ? [
            { ...record('new-alpha', '2026-01-03 00:00:00.000Z'), system: 'alpha' },
            { ...record('old-alpha', '2026-01-02 00:00:00.000Z'), system: 'alpha' },
            { ...record('new-beta', '2026-01-01 00:00:00.000Z'), system: 'beta' },
          ]
        : [record('first', '2026-01-01 00:00:00.000Z')],
    ),
    onConnect: jest.fn(async (handler: () => void) => {
      connectHandler = handler;
      return jest.fn();
    }),
    subscribe: jest.fn(async (collection: string, handler: (event: PocketBaseEvent) => void) => {
      eventHandlers.set(collection, handler);
      return jest.fn();
    }),
    resetSubscriptions: jest.fn(async () => undefined),
  };
}

function internals(service: BridgeService) {
  return service as never as {
    handleEvent: (config: CollectionConfig, event: PocketBaseEvent) => Promise<void>;
    initialize: () => Promise<void>;
    knownFieldTopics: Map<string, Set<string>>;
    knownLatestGroups: Map<string, Set<string>>;
    knownRecords: Map<string, Set<string>>;
    latestUpdated: Map<string, string>;
    clearState: (config: CollectionConfig, key: string, topic: string) => void;
    publishEvent: (config: CollectionConfig, event: PocketBaseEvent) => void;
    publishLatest: (config: CollectionConfig, record: PocketBaseRecord) => void;
    publishRecord: (config: CollectionConfig, record: PocketBaseRecord) => void;
    publishState: (config: CollectionConfig, key: string, topic: string, record: PocketBaseRecord) => void;
    syncLatest: (config: CollectionConfig) => Promise<void>;
    syncRecords: (config: CollectionConfig) => Promise<void>;
  };
}

describe('BridgeService', () => {
  it('declares its runtime dependency injection tokens explicitly', () => {
    expect(Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, BridgeService)).toEqual(
      expect.arrayContaining([
        { index: 0, param: MqttService },
        { index: 1, param: PocketBaseService },
      ]),
    );
  });

  it('publishes state snapshots and events using their configured modes', async () => {
    const mqtt = createMqtt();
    const pocketbase = createPocketBase();
    const service = new BridgeService(mqtt as never, pocketbase as never);

    await service.onModuleInit();

    expect(mqtt.subscribe).toHaveBeenCalledWith('home/latest/get', expect.any(Function));
    expect(pocketbase.subscribe).toHaveBeenCalledWith('grouped', expect.any(Function), 'type = "1m"');
    expect(mqtt.publish).toHaveBeenCalledWith('home/events/events/create', expect.stringContaining('first'));
    expect(mqtt.publish).toHaveBeenCalledWith('home/events/events/create/first/fields/value', 'first');
    expect(mqtt.publish).toHaveBeenCalledWith('home/latest/latest', expect.stringContaining('latest-id'), {
      retain: true,
    });
    expect(mqtt.publish).toHaveBeenCalledWith('home/grouped/latest/alpha', expect.stringContaining('new-alpha'), {
      retain: true,
    });
    expect(mqtt.publish).not.toHaveBeenCalledWith('home/grouped/latest/alpha', expect.stringContaining('old-alpha'), {
      retain: true,
    });
    expect(mqtt.publish).toHaveBeenCalledWith('home/grouped/latest/beta', expect.stringContaining('new-beta'), {
      retain: true,
    });
    expect(mqtt.publish).toHaveBeenCalledWith('home/records/records/first', expect.stringContaining('first'), {
      retain: true,
    });
    expect(mqtt.publish).toHaveBeenCalledWith('home/records/records/first/fields/value', 'first', { retain: true });

    pocketbase.eventHandlers.get('events')?.({
      action: 'create',
      record: record('event-id', '2026-01-03 00:00:00.000Z'),
    });
    pocketbase.eventHandlers.get('records')?.({
      action: 'delete',
      record: record('first', '2026-01-04 00:00:00.000Z'),
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(mqtt.publish).toHaveBeenCalledWith('home/events/events/create', expect.stringContaining('event-id'));
    expect(mqtt.publish).toHaveBeenCalledWith('home/events/events/create/event-id/fields/value', 'event-id');
    expect(mqtt.publish).toHaveBeenCalledWith('home/records/records/first', null, { retain: true });
    expect(mqtt.publish).toHaveBeenCalledWith('home/records/records/first/fields/value', null, { retain: true });
  });

  it('publishes nested JSON fields and clears no-longer-present retained fields', async () => {
    const mqtt = createMqtt();
    const pocketbase = createPocketBase();
    const service = new BridgeService(mqtt as never, pocketbase as never);
    await service.onModuleInit();

    const updatedRecord: PocketBaseRecord = {
      collectionId: 'collection',
      collectionName: 'test',
      created: '2026-01-04 00:00:00.000Z',
      id: 'first',
      updated: '2026-01-04 00:00:00.000Z',
    };
    pocketbase.eventHandlers.get('records')?.({
      action: 'update',
      record: { ...updatedRecord, info: { cpu: { usage: 42 } }, metadata: '{"network":{"rx":12}}' },
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(mqtt.publish).toHaveBeenCalledWith('home/records/records/first/fields/info/cpu/usage', '42', {
      retain: true,
    });
    expect(mqtt.publish).toHaveBeenCalledWith('home/records/records/first/fields/metadata/network/rx', '12', {
      retain: true,
    });
    expect(mqtt.publish).toHaveBeenCalledWith('home/records/records/first/fields/value', null, { retain: true });
  });

  it('refreshes the latest record only for non-retained get commands', async () => {
    const mqtt = createMqtt();
    const pocketbase = createPocketBase();
    const service = new BridgeService(mqtt as never, pocketbase as never);
    await service.onModuleInit();

    const refresh = mqtt.subscribe.mock.calls.find(([topic]) => topic === 'home/latest/get')?.[1];
    refresh?.('home/latest/get', '', { retain: true });
    await new Promise((resolve) => setImmediate(resolve));
    expect(pocketbase.latest).toHaveBeenCalledTimes(1);

    refresh?.('home/latest/get', '', { retain: false });
    await new Promise((resolve) => setImmediate(resolve));
    expect(pocketbase.latest).toHaveBeenCalledTimes(2);
  });

  it('resynchronizes stateful collections after a PocketBase reconnect', async () => {
    const mqtt = createMqtt();
    const pocketbase = createPocketBase();
    const service = new BridgeService(mqtt as never, pocketbase as never);
    await service.onModuleInit();

    pocketbase.getConnectHandler()?.();
    await new Promise((resolve) => setImmediate(resolve));

    expect(pocketbase.latest).toHaveBeenCalledTimes(2);
    expect(pocketbase.list.mock.calls.filter(([collection]) => collection === 'events')).toHaveLength(1);
    expect(pocketbase.list.mock.calls.filter(([collection]) => collection === 'grouped')).toHaveLength(2);
    expect(pocketbase.list.mock.calls.filter(([collection]) => collection === 'records')).toHaveLength(2);
  });

  it('clears state that is absent from the latest result or a records resynchronization', async () => {
    const mqtt = createMqtt();
    const pocketbase = createPocketBase();
    const service = new BridgeService(mqtt as never, pocketbase as never);
    const fieldsLatest: CollectionConfig = {
      collection: 'empty',
      payload: 'fields',
      publish: 'latest',
      topic: 'home/empty',
    };
    const records: CollectionConfig = {
      collection: 'records',
      payload: 'both',
      publish: 'records',
      topic: 'home/records',
    };
    const privateService = internals(service);

    privateService.publishLatest(fieldsLatest, record('latest', '2026-01-02 00:00:00.000Z'));
    pocketbase.latest.mockResolvedValueOnce(undefined as never);
    await privateService.syncLatest(fieldsLatest);
    privateService.publishRecord(records, record('removed', '2026-01-02 00:00:00.000Z'));
    privateService.knownRecords.set('records', new Set(['removed']));
    pocketbase.list.mockResolvedValueOnce([]);
    await privateService.syncRecords(records);
    privateService.clearState(fieldsLatest, 'missing', 'home/empty/missing');

    expect(mqtt.publish).toHaveBeenCalledWith('home/empty/latest/fields/value', null, { retain: true });
    expect(mqtt.publish).toHaveBeenCalledWith('home/records/records/removed', null, { retain: true });
  });

  it('publishes and clears the latest record per configured group', async () => {
    const mqtt = createMqtt();
    const pocketbase = createPocketBase();
    const service = new BridgeService(mqtt as never, pocketbase as never);
    const grouped: CollectionConfig = {
      collection: 'stats',
      filter: 'type = "1m"',
      groupBy: 'system',
      payload: 'both',
      publish: 'latest',
      topic: 'home/stats',
    };
    const privateService = internals(service);
    pocketbase.list.mockResolvedValueOnce([
      { ...record('empty', '2026-01-03 00:00:00.000Z'), system: '' },
      { ...record('numeric', '2026-01-02 00:00:00.000Z'), system: 42 },
    ]);

    await privateService.syncLatest(grouped);
    pocketbase.list.mockResolvedValueOnce([]);
    await privateService.syncLatest(grouped);
    pocketbase.list.mockResolvedValueOnce([record('invalid', '2026-01-04 00:00:00.000Z')]);

    await expect(privateService.syncLatest(grouped)).rejects.toThrow('has no scalar system field');
    expect(mqtt.publish).toHaveBeenCalledWith('home/stats/latest/%00', expect.stringContaining('empty'), {
      retain: true,
    });
    expect(mqtt.publish).toHaveBeenCalledWith('home/stats/latest/42', expect.stringContaining('numeric'), {
      retain: true,
    });
    expect(mqtt.publish).toHaveBeenCalledWith('home/stats/latest/%00', null, { retain: true });
    expect(mqtt.publish).toHaveBeenCalledWith('home/stats/latest/42', null, { retain: true });
  });

  it('honours record-only and field-only payloads and ignores stale records', () => {
    const mqtt = createMqtt();
    const pocketbase = createPocketBase();
    const service = new BridgeService(mqtt as never, pocketbase as never);
    const recordOnly: CollectionConfig = {
      collection: 'record-only',
      payload: 'record',
      publish: 'records',
      topic: 'home/record',
    };
    const fieldsOnly: CollectionConfig = {
      collection: 'fields-only',
      payload: 'fields',
      publish: 'events',
      topic: 'home/fields',
    };
    const privateService = internals(service);
    const current = record('one', '2026-01-02 00:00:00.000Z');

    privateService.publishState(recordOnly, 'record-only/one', 'home/record/records/one', current);
    privateService.publishEvent(fieldsOnly, { action: 'create', record: current });
    privateService.publishEvent(recordOnly, { action: 'create', record: current });
    privateService.publishRecord(recordOnly, current);
    privateService.publishRecord(recordOnly, current);

    expect(mqtt.publish).toHaveBeenCalledWith('home/record/records/one', expect.stringContaining('"one"'), {
      retain: true,
    });
    expect(mqtt.publish).not.toHaveBeenCalledWith('home/record/records/one/fields/value', 'one', { retain: true });
    expect(mqtt.publish).toHaveBeenCalledWith('home/fields/events/create/one/fields/value', 'one');
    expect(mqtt.publish).not.toHaveBeenCalledWith('home/fields/events/create', expect.any(String));
    expect(mqtt.publish).toHaveBeenCalledWith('home/record/events/create', expect.stringContaining('"one"'));
    expect(mqtt.publish.mock.calls.filter(([topic]) => topic === 'home/record/records/one')).toHaveLength(2);
  });

  it('processes latest events, reports processing errors, retries failed setup, and cleans up', async () => {
    jest.useFakeTimers();
    const mqtt = createMqtt();
    const pocketbase = createPocketBase();
    const service = new BridgeService(mqtt as never, pocketbase as never);
    const privateService = internals(service);
    const latest: CollectionConfig = {
      collection: 'latest',
      payload: 'record',
      publish: 'latest',
      topic: 'home/latest',
    };
    const logger = jest
      .spyOn((service as never as { logger: { error: jest.Mock } }).logger, 'error')
      .mockImplementation(() => undefined);

    await privateService.handleEvent(latest, {
      action: 'update',
      record: record('latest', '2026-01-03 00:00:00.000Z'),
    });
    pocketbase.latest.mockRejectedValueOnce(new Error('sync error'));
    await privateService.handleEvent(latest, {
      action: 'update',
      record: record('latest', '2026-01-04 00:00:00.000Z'),
    });
    pocketbase.subscribe.mockRejectedValueOnce(new Error('subscribe error'));
    await privateService.initialize();
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    service.onModuleDestroy();
    await privateService.initialize();

    new BridgeService(createMqtt() as never, createPocketBase() as never).onModuleDestroy();

    expect(pocketbase.latest).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith('Failed to process PocketBase update event for latest', expect.any(Error));
    expect(logger).toHaveBeenCalledWith(
      'PocketBase synchronization setup failed; retrying in five seconds',
      expect.any(Error),
    );
    expect(pocketbase.resetSubscriptions).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
