import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventSource as NodeEventSource } from 'eventsource';
import PocketBase, { type RecordModel } from 'pocketbase';
import { ENV } from '~/config/env';

globalThis.EventSource ??= NodeEventSource as never;

export type PocketBaseAction = 'create' | 'delete' | 'update';
export type PocketBaseRecord = RecordModel & Record<string, unknown>;
export interface PocketBaseEvent {
  action: PocketBaseAction;
  record: PocketBaseRecord;
}

const AUTH_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

@Injectable()
export class PocketBaseService implements OnModuleDestroy {
  private authentication?: Promise<void>;
  private authRefreshTimer?: NodeJS.Timeout;
  private readonly client: PocketBase;
  private readonly logger = new Logger(PocketBaseService.name);
  private readonly unsubscribe = new Set<() => void>();

  constructor() {
    this.client = new PocketBase(ENV.POCKETBASE_URL);
  }

  async list(collection: string, options: { filter?: string; sort?: string } = {}) {
    await this.authenticate();
    return (await this.client
      .collection(collection)
      .getFullList({ ...options, sort: options.sort ?? '-updated,-id' })) as PocketBaseRecord[];
  }

  async latest(collection: string, sort: string, filter?: string) {
    await this.authenticate();
    const result = await this.client.collection(collection).getList(1, 1, { ...(filter ? { filter } : {}), sort });
    return (result.items[0] as PocketBaseRecord | undefined) ?? undefined;
  }

  async subscribe(collection: string, handler: (event: PocketBaseEvent) => void, filter?: string) {
    await this.authenticate();
    const unsubscribe = await this.client
      .collection(collection)
      .subscribe(
        '*',
        (event) => handler({ action: event.action as PocketBaseAction, record: event.record as PocketBaseRecord }),
        filter ? { filter } : undefined,
      );
    this.unsubscribe.add(unsubscribe);
    return () => {
      unsubscribe();
      this.unsubscribe.delete(unsubscribe);
    };
  }

  async onConnect(handler: () => void) {
    const unsubscribe = await this.client.realtime.subscribe('PB_CONNECT', handler);
    this.unsubscribe.add(unsubscribe);
    return () => {
      unsubscribe();
      this.unsubscribe.delete(unsubscribe);
    };
  }

  async resetSubscriptions() {
    await this.client.realtime.unsubscribe();
    this.unsubscribe.clear();
  }

  onModuleDestroy() {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.unsubscribe.clear();
    if (this.authRefreshTimer) clearInterval(this.authRefreshTimer);
    this.client.authStore.clear();
  }

  private async authenticate() {
    this.authentication ??= this.client
      .collection(ENV.POCKETBASE_AUTH_COLLECTION)
      .authWithPassword(ENV.POCKETBASE_USERNAME, ENV.POCKETBASE_PASSWORD)
      .then(() => {
        this.authRefreshTimer ??= setInterval(() => {
          this.authentication = undefined;
          void this.authenticate().catch((error: unknown) =>
            this.logger.error('PocketBase session renewal failed; retrying in 30 minutes', error),
          );
        }, AUTH_REFRESH_INTERVAL_MS);
      })
      .catch((error: unknown) => {
        this.authentication = undefined;
        throw error;
      });
    await this.authentication;
  }
}
