import { createTransmissionCatalog } from '../catalog';
import { InMemoryTransmissionAdapter, Torrent } from '../adapter';

function makeTorrents(): Torrent[] {
  return [
    { hash: 'aaa', name: 'Movie A', percentDone: 1, status: 6 },
    { hash: 'bbb', name: 'Movie B', percentDone: 0.5, status: 4 },
  ];
}

describe('TransmissionCatalog', () => {
  describe('getAll', () => {
    it('returns torrents from the adapter', async () => {
      const adapter = new InMemoryTransmissionAdapter({ torrents: makeTorrents() });
      const catalog = createTransmissionCatalog(adapter);
      const result = await catalog.getAll();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ hash: 'aaa', name: 'Movie A' });
    });

    it('returns an empty array when adapter has no torrents', async () => {
      const adapter = new InMemoryTransmissionAdapter({ torrents: [] });
      const catalog = createTransmissionCatalog(adapter);
      const result = await catalog.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('caching', () => {
    it('caches within TTL and does not call adapter twice', async () => {
      const adapter = new InMemoryTransmissionAdapter({ torrents: makeTorrents() });
      const getAllSpy = jest.spyOn(adapter, 'getAll');
      const catalog = createTransmissionCatalog(adapter, { ttlMs: 60_000 });

      await catalog.getAll();
      await catalog.getAll();

      expect(getAllSpy).toHaveBeenCalledTimes(1);
    });

    it('calls adapter again after TTL expires', async () => {
      const adapter = new InMemoryTransmissionAdapter({ torrents: makeTorrents() });
      const getAllSpy = jest.spyOn(adapter, 'getAll');
      const catalog = createTransmissionCatalog(adapter, { ttlMs: 10 });

      await catalog.getAll();
      await new Promise(r => setTimeout(r, 15));
      await catalog.getAll();

      expect(getAllSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('refresh', () => {
    it('busts the cache so next getAll calls the adapter again', async () => {
      const adapter = new InMemoryTransmissionAdapter({ torrents: makeTorrents() });
      const getAllSpy = jest.spyOn(adapter, 'getAll');
      const catalog = createTransmissionCatalog(adapter, { ttlMs: 60_000 });

      await catalog.getAll();
      catalog.refresh();
      await catalog.getAll();

      expect(getAllSpy).toHaveBeenCalledTimes(2);
    });
  });
});
