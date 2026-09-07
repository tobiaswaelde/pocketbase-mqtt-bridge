const loadConfig = jest.fn(() => ({ collections: [] }));

jest.mock('./runtime', () => ({ loadConfig }));

import { CONFIG } from './config';

describe('CONFIG', () => {
  it('loads the bridge configuration during module initialization', () => {
    expect(loadConfig).toHaveBeenCalledTimes(1);
    expect(CONFIG).toEqual({ collections: [] });
  });
});
