import { flattenRecordFields } from './record-fields';

describe('flattenRecordFields', () => {
  it('preserves primitive arrays while expanding nested objects and JSON-encoded columns', () => {
    expect(
      flattenRecordFields({
        info: {
          cpu: { usage: 42 },
          disks: ['nvme0n1'],
          interfaces: [{ name: 'eth0', rx: 12 }],
        },
        metadata: '{"network":{"rx":12}}',
        name: 'host-a',
        tags: '["cpu","memory"]',
      }),
    ).toEqual([
      { path: ['info', 'cpu', 'usage'], payload: '42' },
      { path: ['info', 'disks'], payload: '["nvme0n1"]' },
      { path: ['info', 'interfaces', '0', 'name'], payload: '"eth0"' },
      { path: ['info', 'interfaces', '0', 'rx'], payload: '12' },
      { path: ['metadata', 'network', 'rx'], payload: '12' },
      { path: ['name'], payload: '"host-a"' },
      { path: ['tags'], payload: '["cpu","memory"]' },
    ]);
  });

  it('preserves empty JSON values and encodes topic-reserved field names', () => {
    expect(flattenRecordFields({ 'a/b': [], empty: {}, nullable: null })).toEqual([
      { path: ['a%2Fb'], payload: '[]' },
      { path: ['empty'], payload: '{}' },
      { path: ['nullable'], payload: 'null' },
    ]);
  });
});
