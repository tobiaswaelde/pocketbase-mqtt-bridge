jest.mock('./modules/bridge.module', () => ({ BridgeModule: class BridgeModule {} }));
jest.mock('./modules/health/health.module', () => ({ HealthModule: class HealthModule {} }));

import { AppModule } from './app.module';

describe('AppModule', () => {
  it('can be initialized', () => {
    expect(AppModule).toBeDefined();
  });
});
