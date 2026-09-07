import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import type { CollectionConfig } from '~/config/config';
import type { MqttBridgeClient } from './mqtt/mqtt.service';
import { MqttService } from './mqtt/mqtt.service';
import type { PocketBaseEvent, PocketBaseRecord } from './pocketbase/pocketbase.service';
import { PocketBaseService } from './pocketbase/pocketbase.service';

const collections: CollectionConfig[] = [
  { collection: 'events', payload: 'both', publish: 'events', topic: 'home/events' },
  { collection: 'latest', payload: 'both', publish: 'latest', topic: 'home/latest' },
  { collection: 'records', payload: 'both', publish: 'records', topic: 'home/records' },
];

jest.mock('~/config/env', () => ({
  ENV: {
    MQTT_CLIENT_ID: '',
    MQTT_HOST: 'mqtt.test',
    MQTT_PORT: 1883,
    MQTT_PROTOCOL: 'mqtt',
    POCKETBASE_API_KEY: 'test-token',
    POCKETBASE_URL: 'https://pocketbase.test',
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
    list: jest.fn(async () => [record('first', '2026-01-01 00:00:00.000Z')]),
    onConnect: jest.fn(async (handler: () => void) => {
      connectHandler = handler;
      return jest.fn();
    }),
    subscribe: jest.fn(async (collection: string, handler: (event: PocketBaseEvent) => void) => {
      eventHandlers.set(collection, handler);
      return jest.fn();
    }),
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
    expect(mqtt.publish).toHaveBeenCalledWith('home/latest/latest', expect.stringContaining('latest-id'), {
      retain: true,
    });
    expect(mqtt.publish).toHaveBeenCalledWith('home/records/records/first', expect.stringContaining('first'), {
      retain: true,
    });
    expect(mqtt.publish).toHaveBeenCalledWith('home/records/records/first/fields/value', '"first"', { retain: true });

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
    expect(mqtt.publish).toHaveBeenCalledWith('home/events/events/create/event-id/fields/value', '"event-id"');
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
    expect(pocketbase.list).toHaveBeenCalledTimes(2);
  });
});
