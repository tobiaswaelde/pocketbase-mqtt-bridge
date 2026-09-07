import { load } from 'js-yaml';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const collectionSchema = z
  .object({
    collection: z.string().regex(/^[A-Za-z0-9_-]+$/, 'collection must contain only letters, numbers, _ and -'),
    publish: z.enum(['events', 'latest', 'records']),
    sort: z.string().min(1).optional(),
    topic: z
      .string()
      .min(1)
      .refine((topic) => !topic.includes('#') && !topic.includes('+'), 'topic must not contain MQTT wildcards'),
  })
  .superRefine((value, context) => {
    if (value.sort && value.publish !== 'latest')
      context.addIssue({ code: 'custom', path: ['sort'], message: 'sort is only supported for latest collections' });
  });

export const configSchema = z
  .object({
    collections: z.array(collectionSchema).min(1),
  })
  .superRefine((value, context) => {
    for (const [index, entry] of value.collections.entries()) {
      const firstCollection = value.collections.findIndex((candidate) => candidate.collection === entry.collection);
      const firstTopic = value.collections.findIndex((candidate) => candidate.topic === entry.topic);
      if (firstCollection !== index)
        context.addIssue({
          code: 'custom',
          path: ['collections', index, 'collection'],
          message: 'collection must be unique',
        });
      if (firstTopic !== index)
        context.addIssue({ code: 'custom', path: ['collections', index, 'topic'], message: 'topic must be unique' });
    }
  });

export type CollectionConfig = z.infer<typeof collectionSchema>;
export type BridgeConfig = z.infer<typeof configSchema>;

export function configFilePath() {
  const index = process.argv.indexOf('--config');
  return path.resolve(process.env.CONFIG_FILE ?? (index >= 0 ? process.argv[index + 1] : 'config/config.yml'));
}

export function loadConfig(): BridgeConfig {
  const file = configFilePath();
  if (!existsSync(file)) throw new Error(`Configuration file not found: ${file}`);
  return configSchema.parse(load(readFileSync(file, 'utf8')));
}
