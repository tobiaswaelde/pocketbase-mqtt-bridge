const listeners = new Map<string, (...args: unknown[]) => void>();
const client = {
  end: jest.fn(),
  on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    listeners.set(event, handler);
    return undefined;
  }),
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
};
const connect = jest.fn(() => client);

jest.mock('mqtt', () => ({ connect }));
jest.mock('~/config/env', () => ({
  ENV: {
    MQTT_CLIENT_ID: 'bridge-client',
    MQTT_HOST: 'mqtt.test',
    MQTT_PASSWORD: 'password',
    MQTT_PORT: 1883,
    MQTT_PROTOCOL: 'mqtt',
    MQTT_USERNAME: 'user',
  },
}));

import { MqttService } from './mqtt.service';

describe('MqttService', () => {
  beforeEach(() => {
    connect.mockClear();
    client.end.mockClear();
    client.publish.mockClear();
    client.subscribe.mockClear();
    client.unsubscribe.mockClear();
    listeners.clear();
  });

  it('connects with the configured broker and publishes retained state', () => {
    const service = new MqttService();
    service.publish('home/state', 'value', { retain: true });
    service.publish('home/state', null, { retain: true });

    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'bridge-client', host: 'mqtt.test', port: 1883, protocol: 'mqtt' }),
    );
    expect(client.publish.mock.calls).toEqual(
      expect.arrayContaining([
        ['home/state', 'value', { retain: true }, expect.any(Function)],
        ['home/state', '', { retain: true }, expect.any(Function)],
      ]),
    );
  });

  it('forwards retained metadata and removes unused subscriptions on shutdown', () => {
    const service = new MqttService();
    const handler = jest.fn();
    const unsubscribe = service.subscribe('home/+/get', handler);
    listeners.get('message')?.('home/device/get', Buffer.from(''), { retain: true });

    expect(handler).toHaveBeenCalledWith('home/device/get', '', { retain: true });
    unsubscribe();
    service.onModuleDestroy();

    expect(client.subscribe).toHaveBeenCalledWith('home/+/get', expect.any(Function));
    expect(client.unsubscribe).toHaveBeenCalledWith('home/+/get');
    expect(client.end).toHaveBeenCalled();
  });

  it('shares broker subscriptions, supports MQTT wildcards, and reports handler failures', () => {
    const service = new MqttService();
    const first = jest.fn();
    const second = jest.fn(() => {
      throw new Error('handler error');
    });
    const unsubscribeFirst = service.subscribe('home/#', first);
    const unsubscribeSecond = service.subscribe('home/#', second);
    const logger = jest
      .spyOn((service as never as { logger: { error: jest.Mock } }).logger, 'error')
      .mockImplementation(() => undefined);

    listeners.get('message')?.('home/device/state', Buffer.from('online'), { retain: false });
    unsubscribeFirst();
    unsubscribeSecond();

    expect(client.subscribe).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith('home/device/state', 'online', { retain: false });
    expect(logger).toHaveBeenCalledWith('MQTT handler failed for home/#', expect.any(Error));
    expect(client.unsubscribe).toHaveBeenCalledWith('home/#');
  });

  it('does not dispatch non-matching filters and reports broker operation failures', () => {
    const service = new MqttService();
    const handler = jest.fn();
    const logger = jest
      .spyOn((service as never as { logger: { error: jest.Mock } }).logger, 'error')
      .mockImplementation(() => undefined);
    service.subscribe('home/+/get', handler);
    service.publish('home/state', 42);

    const subscribeCallback = client.subscribe.mock.calls[0][1] as (error?: Error) => void;
    const publishCallback = client.publish.mock.calls[0][3] as (error?: Error) => void;
    listeners.get('error')?.(new Error('connection error'));
    subscribeCallback(new Error('subscribe error'));
    publishCallback(new Error('publish error'));
    listeners.get('message')?.('home/device/state', Buffer.from('ignored'), { retain: false });

    expect(handler).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith('MQTT connection failed', expect.any(Error));
    expect(logger).toHaveBeenCalledWith('Failed to subscribe home/+/get', expect.any(Error));
    expect(logger).toHaveBeenCalledWith('Failed to publish home/state', expect.any(Error));
  });

  it('allows an unsubscribe callback to run after shutdown', () => {
    const service = new MqttService();
    const unsubscribe = service.subscribe('home/get', jest.fn());

    service.onModuleDestroy();
    unsubscribe();

    expect(client.unsubscribe).not.toHaveBeenCalled();
  });
});
