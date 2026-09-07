import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CONFIG, type CollectionConfig } from '~/config/config';
import { MqttService } from './mqtt/mqtt.service';
import { type PocketBaseEvent, type PocketBaseRecord, PocketBaseService } from './pocketbase/pocketbase.service';

@Injectable()
export class BridgeService implements OnModuleDestroy, OnModuleInit {
  private readonly latestUpdated = new Map<string, string>();
  private readonly knownRecords = new Map<string, Set<string>>();
  private readonly logger = new Logger(BridgeService.name);
  private readonly unsubscribe = new Set<() => void>();
  private destroyed = false;
  private initializing = false;
  private retryTimer?: NodeJS.Timeout;

  constructor(
    private readonly mqtt: MqttService,
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
        this.mqtt.publish(`${config.topic}/events/${event.action}`, JSON.stringify(event));
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
      this.mqtt.publish(`${config.topic}/latest`, null, { retain: true });
      return;
    }
    this.publishLatest(config, record);
  }

  private async syncRecords(config: CollectionConfig) {
    const records = await this.pocketbase.list(config.collection);
    const currentIds = new Set(records.map((record) => record.id));
    for (const id of this.knownRecords.get(config.collection) ?? [])
      if (!currentIds.has(id)) this.mqtt.publish(`${config.topic}/records/${id}`, null, { retain: true });
    this.knownRecords.set(config.collection, currentIds);
    for (const record of records) this.publishRecord(config, record);
  }

  private publishRecordEvent(config: CollectionConfig, event: PocketBaseEvent) {
    if (event.action === 'delete') {
      this.knownRecords.get(config.collection)?.delete(event.record.id);
      this.mqtt.publish(`${config.topic}/records/${event.record.id}`, null, { retain: true });
      return;
    }
    this.knownRecords.get(config.collection)?.add(event.record.id);
    this.publishRecord(config, event.record);
  }

  private publishLatest(config: CollectionConfig, record: PocketBaseRecord) {
    if (this.isStale(config.collection, record)) return;
    this.latestUpdated.set(config.collection, record.updated);
    this.mqtt.publish(`${config.topic}/latest`, JSON.stringify(record), { retain: true });
  }

  private publishRecord(config: CollectionConfig, record: PocketBaseRecord) {
    const key = `${config.collection}/${record.id}`;
    if (this.isStale(key, record)) return;
    this.latestUpdated.set(key, record.updated);
    this.mqtt.publish(`${config.topic}/records/${record.id}`, JSON.stringify(record), { retain: true });
  }

  private isStale(key: string, record: PocketBaseRecord) {
    const previous = this.latestUpdated.get(key);
    return previous !== undefined && previous >= record.updated;
  }
}
