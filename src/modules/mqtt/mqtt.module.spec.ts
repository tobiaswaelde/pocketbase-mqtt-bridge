jest.mock('./mqtt.service', () => ({ MqttService: class MqttService {} }));

import { MqttModule } from './mqtt.module';

describe('MqttModule', () => {
  it('can be initialized', () => {
    expect(MqttModule).toBeDefined();
  });
});
