const mockCollection = jest.fn();
const mockRealtimeSubscribe = jest.fn();
const mockRealtimeUnsubscribe = jest.fn();
const mockAuthClear = jest.fn();
const mockAuthWithPassword = jest.fn();
const mockClient = {
  authStore: { clear: mockAuthClear },
  collection: mockCollection,
  realtime: { subscribe: mockRealtimeSubscribe, unsubscribe: mockRealtimeUnsubscribe },
};
const mockPocketBase = jest.fn(() => mockClient);

jest.mock('pocketbase', () => ({ __esModule: true, default: mockPocketBase }));
jest.mock('eventsource', () => ({ EventSource: class EventSource {} }));
jest.mock('~/config/env', () => ({
  ENV: {
    POCKETBASE_AUTH_COLLECTION: 'users',
    POCKETBASE_PASSWORD: 'secret',
    POCKETBASE_URL: 'https://pb.example.test',
    POCKETBASE_USERNAME: 'bridge@example.test',
  },
}));

import { PocketBaseService } from './pocketbase.service';

describe('PocketBaseService', () => {
  beforeEach(() => {
    mockCollection.mockReset();
    mockRealtimeSubscribe.mockReset();
    mockRealtimeUnsubscribe.mockReset();
    mockAuthClear.mockReset();
    mockAuthWithPassword.mockReset().mockResolvedValue({});
    mockPocketBase.mockClear();
  });

  it('authenticates and exposes PocketBase collection operations', async () => {
    const getFullList = jest.fn().mockResolvedValue([{ id: 'one' }]);
    const getList = jest
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'latest' }] })
      .mockResolvedValueOnce({ items: [] });
    mockCollection.mockImplementation((collection: string) =>
      collection === 'users' ? { authWithPassword: mockAuthWithPassword } : { getFullList, getList },
    );
    const service = new PocketBaseService();

    await expect(service.list('systems', { filter: 'status = "up"' })).resolves.toEqual([{ id: 'one' }]);
    await expect(service.latest('systems', '-created')).resolves.toEqual({ id: 'latest' });
    await expect(service.latest('systems', '-created', 'status = "up"')).resolves.toBeUndefined();
    service.onModuleDestroy();

    expect(mockPocketBase).toHaveBeenCalledWith('https://pb.example.test');
    expect(mockAuthWithPassword).toHaveBeenCalledWith('bridge@example.test', 'secret');
    expect(getFullList).toHaveBeenCalledWith({ filter: 'status = "up"', sort: '-updated,-id' });
    expect(getList).toHaveBeenNthCalledWith(1, 1, 1, { sort: '-created' });
    expect(getList).toHaveBeenNthCalledWith(2, 1, 1, { filter: 'status = "up"', sort: '-created' });
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
    mockCollection.mockImplementation((name: string) =>
      name === 'users' ? { authWithPassword: mockAuthWithPassword } : collection(),
    );
    mockRealtimeSubscribe.mockImplementation(async (_topic, handler) => {
      connectHandler = handler;
      return connectUnsubscribe;
    });
    const service = new PocketBaseService();
    const eventHandler = jest.fn();
    const connectionHandler = jest.fn();

    const unsubscribeCollection = await service.subscribe('systems', eventHandler, 'status = "up"');
    const unsubscribeConnect = await service.onConnect(connectionHandler);
    collectionHandler?.({ action: 'update', record: { id: 'one' } });
    connectHandler?.();
    unsubscribeCollection();
    unsubscribeConnect();
    await service.resetSubscriptions();
    service.onModuleDestroy();

    expect(eventHandler).toHaveBeenCalledWith({ action: 'update', record: { id: 'one' } });
    expect(connectionHandler).toHaveBeenCalled();
    expect(collectionSubscribe).toHaveBeenCalledWith('*', expect.any(Function), { filter: 'status = "up"' });
    expect(collectionUnsubscribe).toHaveBeenCalledTimes(1);
    expect(connectUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockRealtimeUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockAuthClear).toHaveBeenCalledTimes(1);
  });

  it('cleans up subscriptions that were not individually removed', async () => {
    const collectionUnsubscribe = jest.fn();
    mockCollection.mockImplementation((collection: string) =>
      collection === 'users'
        ? { authWithPassword: mockAuthWithPassword }
        : { subscribe: jest.fn().mockResolvedValue(collectionUnsubscribe) },
    );
    const service = new PocketBaseService();

    await service.subscribe('systems', jest.fn());
    service.onModuleDestroy();

    expect(collectionUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('can be destroyed before authentication starts', () => {
    new PocketBaseService().onModuleDestroy();

    expect(mockAuthClear).toHaveBeenCalledTimes(1);
  });

  it('retries authentication after a failed login', async () => {
    const getFullList = jest.fn().mockResolvedValue([]);
    mockAuthWithPassword.mockRejectedValueOnce(new Error('login failed')).mockResolvedValueOnce({});
    mockCollection.mockImplementation((collection: string) =>
      collection === 'users' ? { authWithPassword: mockAuthWithPassword } : { getFullList },
    );
    const service = new PocketBaseService();

    await expect(service.list('systems')).rejects.toThrow('login failed');
    await expect(service.list('systems')).resolves.toEqual([]);

    expect(mockAuthWithPassword).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
  });

  it('renews the PocketBase session periodically and reports renewal errors', async () => {
    jest.useFakeTimers();
    const getFullList = jest.fn().mockResolvedValue([]);
    mockCollection.mockImplementation((collection: string) =>
      collection === 'users' ? { authWithPassword: mockAuthWithPassword } : { getFullList },
    );
    const service = new PocketBaseService();
    const logger = jest
      .spyOn((service as never as { logger: { error: jest.Mock } }).logger, 'error')
      .mockImplementation(() => undefined);
    await service.list('systems');
    mockAuthWithPassword.mockRejectedValueOnce(new Error('renewal failed'));

    await jest.advanceTimersByTimeAsync(30 * 60 * 1000);

    expect(mockAuthWithPassword).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith('PocketBase session renewal failed; retrying in 30 minutes', expect.any(Error));
    await jest.advanceTimersByTimeAsync(30 * 60 * 1000);
    service.onModuleDestroy();

    expect(mockAuthWithPassword).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });
});
