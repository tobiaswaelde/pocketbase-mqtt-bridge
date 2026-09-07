import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CONFIG, type CollectionConfig } from '~/config/config';
import { MqttService } from './mqtt/mqtt.service';
import { type PocketBaseEvent, type PocketBaseRecord, PocketBaseService } from './pocketbase/pocketbase.service';
import { flattenRecordFields } from './record-fields';

@Injectable()
export class BridgeService implements OnModuleDestroy, OnModuleInit {
  private readonly latestUpdated = new Map<string, string>();
  private readonly knownRecords = new Map<string, Set<string>>();
  private readonly knownFieldTopics = new Map<string, Set<string>>();
  private readonly logger = new Logger(BridgeService.name);
  private readonly unsubscribe = new Set<() => void>();
  private destroyed = false;
  private initializing = false;
  private retryTimer?: NodeJS.Timeout;

  constructor(
    @Inject(MqttService)
    private readonly mqtt: MqttService,
    @Inject(PocketBaseService)
    private readonly pocketbase: PocketBaseService,
  ) {}

  async onModuleInit() {
    await this.initialize();
  }

  onModuleDestroy() {
    this.destroyed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.resetSubscriptions();
  }

  private async initialize() {
    if (this.destroyed || this.initializing) return;
    this.initializing = true;
    try {
      await this.start();
    } catch (error) {
      this.logger.error('PocketBase synchronization setup failed; retrying in five seconds', error);
      await this.resetSubscriptions();
      this.retryTimer = setTimeout(() => void this.initialize(), 5000);
    } finally {
      this.initializing = false;
    }
  }

  private async start() {
    for (const config of CONFIG.collections) {
      this.unsubscribe.add(
        await this.pocketbase.subscribe(config.collection, (event) => void this.handleEvent(config, event)),
      );
      if (config.publish === 'latest')
        this.unsubscribe.add(
          this.mqtt.subscribe(`${config.topic}/get`, (_, __, packet) => {
            if (!packet.retain) void this.syncLatest(config);
          }),
        );
    }
    this.unsubscribe.add(await this.pocketbase.onConnect(() => void this.syncStatefulCollections()));
    await this.syncStatefulCollections();
  }

  private resetSubscriptions() {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.unsubscribe.clear();
    return this.pocketbase.resetSubscriptions();
  }

  private async handleEvent(config: CollectionConfig, event: PocketBaseEvent) {
    try {
      if (config.publish === 'events') {
        this.publishEvent(config, event);
        return;
      }
      if (config.publish === 'latest') {
        await this.syncLatest(config);
        return;
      }
      this.publishRecordEvent(config, event);
    } catch (error) {
      this.logger.error(`Failed to process PocketBase ${event.action} event for ${config.collection}`, error);
    }
  }

  private async syncStatefulCollections() {
    await Promise.all(
      CONFIG.collections.filter((config) => config.publish !== 'events').map((config) => this.syncCollection(config)),
    );
  }

  private syncCollection(config: CollectionConfig) {
    return config.publish === 'latest' ? this.syncLatest(config) : this.syncRecords(config);
  }

  private async syncLatest(config: CollectionConfig) {
    const record = await this.pocketbase.latest(config.collection, config.sort ?? '-updated,-id');
    if (!record) {
      this.latestUpdated.delete(config.collection);
      this.clearState(config, config.collection, `${config.topic}/latest`);
      return;
    }
    this.publishLatest(config, record);
  }

  private async syncRecords(config: CollectionConfig) {
    const records = await this.pocketbase.list(config.collection);
    const currentIds = new Set(records.map((record) => record.id));
    for (const id of this.knownRecords.get(config.collection) ?? [])
      if (!currentIds.has(id)) this.clearState(config, `${config.collection}/${id}`, `${config.topic}/records/${id}`);
    this.knownRecords.set(config.collection, currentIds);
    for (const record of records) this.publishRecord(config, record);
  }

  private publishRecordEvent(config: CollectionConfig, event: PocketBaseEvent) {
    if (event.action === 'delete') {
      this.knownRecords.get(config.collection)?.delete(event.record.id);
      this.clearState(config, `${config.collection}/${event.record.id}`, `${config.topic}/records/${event.record.id}`);
      return;
    }
    this.knownRecords.get(config.collection)?.add(event.record.id);
    this.publishRecord(config, event.record);
  }

  private publishLatest(config: CollectionConfig, record: PocketBaseRecord) {
    if (this.isStale(config.collection, record)) return;
    this.latestUpdated.set(config.collection, record.updated);
    this.publishState(config, config.collection, `${config.topic}/latest`, record);
  }

  private publishRecord(config: CollectionConfig, record: PocketBaseRecord) {
    const key = `${config.collection}/${record.id}`;
    if (this.isStale(key, record)) return;
    this.latestUpdated.set(key, record.updated);
    this.publishState(config, key, `${config.topic}/records/${record.id}`, record);
  }

  private publishEvent(config: CollectionConfig, event: PocketBaseEvent) {
    const baseTopic = `${config.topic}/events/${event.action}`;
    if (this.includesRecord(config)) this.mqtt.publish(baseTopic, JSON.stringify(event));
    if (this.includesFields(config))
      for (const field of flattenRecordFields(event.record))
        this.mqtt.publish(`${baseTopic}/${event.record.id}/fields/${field.path.join('/')}`, field.payload);
  }

  private publishState(config: CollectionConfig, key: string, baseTopic: string, record: PocketBaseRecord) {
    if (this.includesRecord(config)) this.mqtt.publish(baseTopic, JSON.stringify(record), { retain: true });
    if (!this.includesFields(config)) return;
    const currentTopics = new Set<string>();
    for (const field of flattenRecordFields(record)) {
      const topic = `${baseTopic}/fields/${field.path.join('/')}`;
      currentTopics.add(topic);
      this.mqtt.publish(topic, field.payload, { retain: true });
    }
    for (const topic of this.knownFieldTopics.get(key) ?? [])
      if (!currentTopics.has(topic)) this.mqtt.publish(topic, null, { retain: true });
    this.knownFieldTopics.set(key, currentTopics);
  }

  private clearState(config: CollectionConfig, key: string, baseTopic: string) {
    if (this.includesRecord(config)) this.mqtt.publish(baseTopic, null, { retain: true });
    for (const topic of this.knownFieldTopics.get(key) ?? []) this.mqtt.publish(topic, null, { retain: true });
    this.knownFieldTopics.delete(key);
  }

  private includesRecord(config: CollectionConfig) {
    return config.payload !== 'fields';
  }

  private includesFields(config: CollectionConfig) {
    return config.payload !== 'record';
  }

  private isStale(key: string, record: PocketBaseRecord) {
    const previous = this.latestUpdated.get(key);
    return previous !== undefined && previous >= record.updated;
  }
}
