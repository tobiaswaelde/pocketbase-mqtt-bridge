import { flattenRecordFields } from './record-fields';

describe('flattenRecordFields', () => {
  it('expands nested JSON objects, arrays, and JSON-encoded columns into topic paths', () => {
    expect(
      flattenRecordFields({
        info: { cpu: { usage: 42 }, disks: ['nvme0n1'] },
        metadata: '{"network":{"rx":12}}',
        name: 'host-a',
      }),
    ).toEqual([
      { path: ['info', 'cpu', 'usage'], payload: '42' },
      { path: ['info', 'disks', '0'], payload: '"nvme0n1"' },
      { path: ['metadata', 'network', 'rx'], payload: '12' },
      { path: ['name'], payload: '"host-a"' },
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
