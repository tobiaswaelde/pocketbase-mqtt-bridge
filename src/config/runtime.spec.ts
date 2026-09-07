import { configSchema } from './runtime';

describe('configSchema', () => {
  it('accepts independently configured collection publishing modes', () => {
    expect(
      configSchema.parse({
        collections: [
          { collection: 'audit_log', publish: 'events', topic: 'home/pocketbase/audit' },
          { collection: 'systems', publish: 'latest', sort: '-created,-id', topic: 'home/pocketbase/systems' },
          { collection: 'users', publish: 'records', topic: 'home/pocketbase/users' },
        ],
      }),
    ).toEqual({
      collections: [
        { collection: 'audit_log', publish: 'events', topic: 'home/pocketbase/audit' },
        { collection: 'systems', publish: 'latest', sort: '-created,-id', topic: 'home/pocketbase/systems' },
        { collection: 'users', publish: 'records', topic: 'home/pocketbase/users' },
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
  ];

  it.each(invalidConfigs)('rejects invalid collection configuration: %j', ({ collections }) => {
    expect(() => configSchema.parse({ collections })).toThrow();
  });
});
