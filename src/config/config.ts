import { loadConfig } from './runtime';

export type { BridgeConfig, CollectionConfig } from './runtime';

export const CONFIG = loadConfig();
