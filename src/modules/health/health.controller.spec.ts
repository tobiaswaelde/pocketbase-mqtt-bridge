import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports a healthy bridge process', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });
});
