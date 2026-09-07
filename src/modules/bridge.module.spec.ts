jest.mock('./bridge.service', () => ({ BridgeService: class BridgeService {} }));
jest.mock('./mqtt/mqtt.module', () => ({ MqttModule: class MqttModule {} }));
jest.mock('./pocketbase/pocketbase.module', () => ({ PocketBaseModule: class PocketBaseModule {} }));

import { BridgeModule } from './bridge.module';

describe('BridgeModule', () => {
  it('can be initialized', () => {
    expect(BridgeModule).toBeDefined();
  });
});
