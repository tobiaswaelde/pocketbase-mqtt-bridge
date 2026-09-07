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
});
