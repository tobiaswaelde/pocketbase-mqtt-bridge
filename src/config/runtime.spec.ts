import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { configFilePath, configSchema, loadConfig } from './runtime';

describe('configSchema', () => {
  it('accepts independently configured collection publishing modes', () => {
    expect(
      configSchema.parse({
        collections: [
          { collection: 'audit_log', publish: 'events', topic: 'home/pocketbase/audit' },
          {
            collection: 'systems',
            payload: 'fields',
            publish: 'latest',
            sort: '-created,-id',
            topic: 'home/pocketbase/systems',
          },
          { collection: 'users', payload: 'both', publish: 'records', topic: 'home/pocketbase/users' },
        ],
      }),
    ).toEqual({
      collections: [
        { collection: 'audit_log', payload: 'record', publish: 'events', topic: 'home/pocketbase/audit' },
        {
          collection: 'systems',
          payload: 'fields',
          publish: 'latest',
          sort: '-created,-id',
          topic: 'home/pocketbase/systems',
        },
        { collection: 'users', payload: 'both', publish: 'records', topic: 'home/pocketbase/users' },
      ],
    });
  });

  const invalidConfigs: { collections: unknown }[] = [
    { collections: [{ collection: 'systems', publish: 'records', topic: 'home/#' }] },
    {
      collections: [
        { collection: 'systems', publish: 'records', topic: 'home/systems' },
        { collection: 'systems', publish: 'events', topic: 'home/events' },
      ],
    },
    {
      collections: [
        { collection: 'systems', publish: 'latest', topic: 'home/systems' },
        { collection: 'users', publish: 'events', topic: 'home/systems' },
      ],
    },
    { collections: [{ collection: 'systems', publish: 'records', sort: '-updated', topic: 'home/systems' }] },
    { collections: [{ collection: 'systems', payload: 'unknown', publish: 'records', topic: 'home/systems' }] },
  ];

  it.each(invalidConfigs)('rejects invalid collection configuration: %j', ({ collections }) => {
    expect(() => configSchema.parse({ collections })).toThrow();
  });

  it('resolves configuration file paths from the environment, command line, and default', () => {
    const originalEnvironment = process.env.CONFIG_FILE;
    const originalArguments = process.argv;

    process.env.CONFIG_FILE = 'environment.yml';
    process.argv = ['node', 'bridge', '--config', 'command-line.yml'];
    expect(configFilePath()).toBe(path.resolve('environment.yml'));

    delete process.env.CONFIG_FILE;
    expect(configFilePath()).toBe(path.resolve('command-line.yml'));

    process.argv = ['node', 'bridge'];
    expect(configFilePath()).toBe(path.resolve('config/config.yml'));

    process.argv = originalArguments;
    if (originalEnvironment === undefined) delete process.env.CONFIG_FILE;
    else process.env.CONFIG_FILE = originalEnvironment;
  });

  it('loads a valid YAML configuration and reports a missing file', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'pocketbase-mqtt-bridge-'));
    const file = path.join(directory, 'config.yml');
    const original = process.env.CONFIG_FILE;
    writeFileSync(file, 'collections:\n  - collection: systems\n    publish: records\n    topic: home/systems\n');
    process.env.CONFIG_FILE = file;

    expect(loadConfig()).toEqual({
      collections: [{ collection: 'systems', payload: 'record', publish: 'records', topic: 'home/systems' }],
    });

    process.env.CONFIG_FILE = path.join(directory, 'missing.yml');
    expect(() => loadConfig()).toThrow('Configuration file not found');

    if (original === undefined) delete process.env.CONFIG_FILE;
    else process.env.CONFIG_FILE = original;
    rmSync(directory, { force: true, recursive: true });
  });
});
