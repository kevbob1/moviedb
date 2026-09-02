import { InMemoryTransmissionAdapter } from '../adapter';

describe('InMemoryTransmissionAdapter', () => {
  const torrents = [{ hash: 'a', name: 'A', percentDone: 1, status: 6, isFinished: true, error: 'none', files: ['a.mkv'] }];

  it('supports all and selected reads with the same seam', async () => {
    const adapter = new InMemoryTransmissionAdapter({ torrents });
    expect(await adapter.getTorrents()).toEqual(torrents);
    expect(await adapter.getTorrents(['a'])).toEqual(torrents);
    expect(await adapter.getTorrents(['missing'])).toEqual([]);
    expect(await adapter.getTorrents([])).toEqual([]);
  });

  it('returns an empty all-read when unconfigured is represented by no torrents', async () => {
    expect(await new InMemoryTransmissionAdapter().getTorrents()).toEqual([]);
  });
});
