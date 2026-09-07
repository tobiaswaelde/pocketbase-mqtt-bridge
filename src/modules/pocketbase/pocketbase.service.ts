import { Injectable, OnModuleDestroy } from '@nestjs/common';
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

@Injectable()
export class PocketBaseService implements OnModuleDestroy {
  private readonly client: PocketBase;
  private readonly unsubscribe = new Set<() => void>();

  constructor() {
    this.client = new PocketBase(ENV.POCKETBASE_URL);
    this.client.authStore.save(ENV.POCKETBASE_API_KEY, null);
  }

  async list(collection: string) {
    return (await this.client.collection(collection).getFullList({ sort: '-updated,-id' })) as PocketBaseRecord[];
  }

  async latest(collection: string, sort: string) {
    const result = await this.client.collection(collection).getList(1, 1, { sort });
    return (result.items[0] as PocketBaseRecord | undefined) ?? undefined;
  }

  async subscribe(collection: string, handler: (event: PocketBaseEvent) => void) {
    const unsubscribe = await this.client
      .collection(collection)
      .subscribe('*', (event) =>
        handler({ action: event.action as PocketBaseAction, record: event.record as PocketBaseRecord }),
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
  }
}
