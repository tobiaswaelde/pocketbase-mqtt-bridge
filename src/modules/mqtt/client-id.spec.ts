import { resolveMqttClientId } from './client-id';

describe('resolveMqttClientId', () => {
  it('preserves configured client IDs', () => {
    expect(resolveMqttClientId('pocketbase-mqtt-bridge')).toBe('pocketbase-mqtt-bridge');
  });

  it('generates a UUID for an empty client ID', () => {
    expect(resolveMqttClientId('')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
