jest.mock('./health.controller', () => ({ HealthController: class HealthController {} }));

import { HealthModule } from './health.module';

describe('HealthModule', () => {
  it('can be initialized', () => {
    expect(HealthModule).toBeDefined();
  });
});
