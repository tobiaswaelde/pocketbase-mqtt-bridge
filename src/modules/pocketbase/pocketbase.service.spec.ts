const mockCollection = jest.fn();
const mockRealtimeSubscribe = jest.fn();
const mockRealtimeUnsubscribe = jest.fn();
const mockSave = jest.fn();
const mockClient = {
  authStore: { save: mockSave },
  collection: mockCollection,
  realtime: { subscribe: mockRealtimeSubscribe, unsubscribe: mockRealtimeUnsubscribe },
};
const mockPocketBase = jest.fn(() => mockClient);

jest.mock('pocketbase', () => ({ __esModule: true, default: mockPocketBase }));
jest.mock('eventsource', () => ({ EventSource: class EventSource {} }));
jest.mock('~/config/env', () => ({
  ENV: { POCKETBASE_API_KEY: 'api-key', POCKETBASE_URL: 'https://pb.example.test' },
}));

import { PocketBaseService } from './pocketbase.service';

describe('PocketBaseService', () => {
  beforeEach(() => {
    mockCollection.mockReset();
    mockRealtimeSubscribe.mockReset();
    mockRealtimeUnsubscribe.mockReset();
    mockSave.mockReset();
    mockPocketBase.mockClear();
  });

  it('authenticates and exposes PocketBase collection operations', async () => {
    const getFullList = jest.fn().mockResolvedValue([{ id: 'one' }]);
    const getList = jest
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'latest' }] })
      .mockResolvedValueOnce({ items: [] });
    mockCollection.mockReturnValue({ getFullList, getList });
    const service = new PocketBaseService();

    await expect(service.list('systems')).resolves.toEqual([{ id: 'one' }]);
    await expect(service.latest('systems', '-created')).resolves.toEqual({ id: 'latest' });
    await expect(service.latest('systems', '-created')).resolves.toBeUndefined();

    expect(mockPocketBase).toHaveBeenCalledWith('https://pb.example.test');
    expect(mockSave).toHaveBeenCalledWith('api-key', null);
    expect(getFullList).toHaveBeenCalledWith({ sort: '-updated,-id' });
    expect(getList).toHaveBeenCalledWith(1, 1, { sort: '-created' });
  });

  it('tracks and removes realtime subscriptions', async () => {
    const collectionUnsubscribe = jest.fn();
    const connectUnsubscribe = jest.fn();
    const collectionSubscribe = jest.fn().mockResolvedValue(collectionUnsubscribe);
    const collection = jest.fn(() => ({ subscribe: collectionSubscribe }));
    let collectionHandler: ((event: { action: string; record: { id: string } }) => void) | undefined;
    let connectHandler: (() => void) | undefined;
    collectionSubscribe.mockImplementation(async (_topic, handler) => {
      collectionHandler = handler;
      return collectionUnsubscribe;
    });
    mockCollection.mockImplementation(collection);
    mockRealtimeSubscribe.mockImplementation(async (_topic, handler) => {
      connectHandler = handler;
      return connectUnsubscribe;
    });
    const service = new PocketBaseService();
    const eventHandler = jest.fn();
    const connectionHandler = jest.fn();

    const unsubscribeCollection = await service.subscribe('systems', eventHandler);
    const unsubscribeConnect = await service.onConnect(connectionHandler);
    collectionHandler?.({ action: 'update', record: { id: 'one' } });
    connectHandler?.();
    unsubscribeCollection();
    unsubscribeConnect();
    await service.resetSubscriptions();
    service.onModuleDestroy();

    expect(eventHandler).toHaveBeenCalledWith({ action: 'update', record: { id: 'one' } });
    expect(connectionHandler).toHaveBeenCalled();
    expect(collectionUnsubscribe).toHaveBeenCalledTimes(1);
    expect(connectUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockRealtimeUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('cleans up subscriptions that were not individually removed', async () => {
    const collectionUnsubscribe = jest.fn();
    mockCollection.mockReturnValue({ subscribe: jest.fn().mockResolvedValue(collectionUnsubscribe) });
    const service = new PocketBaseService();

    await service.subscribe('systems', jest.fn());
    service.onModuleDestroy();

    expect(collectionUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
