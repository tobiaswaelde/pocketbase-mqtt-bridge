import { normalizeEnvironment, normalizePocketBaseUrl } from './environment';

jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('normalizeEnvironment', () => {
  it('removes .env-style wrapping quotes from injected values', () => {
    expect(
      normalizeEnvironment({
        MQTT_HOST: '"broker.example.test"',
        MQTT_PASSWORD: "'password'",
        POCKETBASE_URL: '""https://pocketbase.example.test/""',
      }),
    ).toEqual({
      MQTT_HOST: 'broker.example.test',
      MQTT_PASSWORD: 'password',
      POCKETBASE_URL: 'https://pocketbase.example.test/',
    });
  });

  it('leaves unquoted values unchanged', () => {
    expect(normalizeEnvironment({ MQTT_PORT: '1883' })).toEqual({ MQTT_PORT: '1883' });
  });

  it('maps PocketBase dashboard URLs to the server root', () => {
    expect(normalizePocketBaseUrl('https://pocketbase.example.test/_/')).toBe('https://pocketbase.example.test/');
  });

  it('keeps regular PocketBase URLs unchanged', () => {
    expect(normalizePocketBaseUrl('https://pocketbase.example.test/api/')).toBe('https://pocketbase.example.test/api/');
  });

  it('validates and normalizes the runtime environment', () => {
    const original = process.env;
    process.env = {
      ...original,
      MQTT_HOST: '"mqtt.example.test"',
      POCKETBASE_API_KEY: "'api-key'",
      POCKETBASE_URL: 'https://pocketbase.example.test/_/',
    };
    jest.resetModules();

    let env: typeof import('./env');
    jest.isolateModules(() => {
      env = jest.requireActual('./env') as typeof import('./env');
    });

    expect(env!.ENV).toMatchObject({
      CORS_ORIGIN: '*',
      HOST: '0.0.0.0',
      MQTT_HOST: 'mqtt.example.test',
      MQTT_PORT: 1883,
      MQTT_PROTOCOL: 'mqtt',
      POCKETBASE_API_KEY: 'api-key',
      POCKETBASE_URL: 'https://pocketbase.example.test/',
      PORT: 3000,
    });
    process.env = original;
  });
});
