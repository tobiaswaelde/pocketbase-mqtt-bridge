import { normalizeEnvironment } from './environment';

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
});
