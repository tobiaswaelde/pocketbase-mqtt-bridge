jest.mock('./pocketbase.service', () => ({ PocketBaseService: class PocketBaseService {} }));

import { PocketBaseModule } from './pocketbase.module';

describe('PocketBaseModule', () => {
  it('can be initialized', () => {
    expect(PocketBaseModule).toBeDefined();
  });
});
