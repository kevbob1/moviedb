import { createJellyfinCatalog, AvailabilityResult, SeasonsResult } from '../catalog';
import { InMemoryJellyfinAdapter } from '../adapter';

const fixture = () =>
  new InMemoryJellyfinAdapter({
    movies: ['123', '456'],
    seasons: { '100': new Set([1, 2, 3]) },
  });

describe('JellyfinCatalog', () => {
  describe('isOnJellyfin', () => {
    it('returns available: true for a known id', async () => {
      const catalog = createJellyfinCatalog(fixture());
      const result = await catalog.isOnJellyfin(123);
      expect(result).toEqual<AvailabilityResult>({ available: true, configured: true });
    });

    it('returns available: false for an unknown id', async () => {
      const catalog = createJellyfinCatalog(fixture());
      const result = await catalog.isOnJellyfin(999);
      expect(result).toEqual<AvailabilityResult>({ available: false, configured: true });
    });

    it('propagates adapter error', async () => {
      const adapter = new InMemoryJellyfinAdapter({ error: 'Jellyfin down' });
      const catalog = createJellyfinCatalog(adapter);
      const result = await catalog.isOnJellyfin(1);
      expect(result.available).toBe(false);
      expect(result.configured).toBe(false);
      expect(result.error).toBe('Jellyfin down');
    });
  });

  describe('seasonsFor', () => {
    it('returns sorted seasons for a known show', async () => {
      const catalog = createJellyfinCatalog(fixture());
      const result = await catalog.seasonsFor(100);
      expect(result).toEqual<SeasonsResult>({ seasons: [1, 2, 3], configured: true });
    });

    it('returns empty array for an unknown show', async () => {
      const catalog = createJellyfinCatalog(fixture());
      const result = await catalog.seasonsFor(999);
      expect(result).toEqual<SeasonsResult>({ seasons: [], configured: true });
    });

    it('propagates adapter error', async () => {
      const catalog = createJellyfinCatalog(new InMemoryJellyfinAdapter({ error: 'Jellyfin down' }));
      const result = await catalog.seasonsFor(100);
      expect(result.seasons).toEqual([]);
      expect(result.configured).toBe(false);
      expect(result.error).toBe('Jellyfin down');
    });
  });

  describe('availabilityFor', () => {
    it('returns a record keyed by id with available boolean', async () => {
      const catalog = createJellyfinCatalog(fixture());
      const result = await catalog.availabilityFor([123, 999, 456]);
      expect(result).toEqual({
        123: { available: true, configured: true },
        999: { available: false, configured: true },
        456: { available: true, configured: true },
      });
    });

    it('returns an empty record when input is empty', async () => {
      const catalog = createJellyfinCatalog(fixture());
      const result = await catalog.availabilityFor([]);
      expect(result).toEqual({});
    });
  });

  describe('seasonsForMany', () => {
    it('returns a record with empty arrays for unknown shows', async () => {
      const catalog = createJellyfinCatalog(fixture());
      const result = await catalog.seasonsForMany([100, 999]);
      expect(result).toEqual({
        100: { seasons: [1, 2, 3], configured: true },
        999: { seasons: [], configured: true },
      });
    });
  });

  describe('ping', () => {
    it('returns configured and reachable from the adapter', async () => {
      const catalog = createJellyfinCatalog(new InMemoryJellyfinAdapter({ ping: { reachable: true } }));
      const result = await catalog.ping();
      expect(result.configured).toBe(true);
      expect(result.reachable).toBe(true);
    });

    it('returns reachable: false when adapter ping fails', async () => {
      const catalog = createJellyfinCatalog(new InMemoryJellyfinAdapter({ ping: { reachable: false, error: '401 Unauthorized' } }));
      const result = await catalog.ping();
      expect(result.configured).toBe(true);
      expect(result.reachable).toBe(false);
      expect(result.error).toBe('401 Unauthorized');
    });

    it('returns configured: false when adapter reports error in fetchCatalog', async () => {
      const catalog = createJellyfinCatalog(new InMemoryJellyfinAdapter({ error: 'not configured' }));
      const result = await catalog.ping();
      expect(result.configured).toBe(false);
    });
  });

  describe('caching', () => {
    it('does not call the adapter twice within ttl', async () => {
      const fetchCatalog = jest.fn().mockResolvedValue({ movies: new Set(['1']), seasons: new Map() });
      const adapter = { fetchCatalog, ping: jest.fn().mockResolvedValue({ reachable: true }) };
      const catalog = createJellyfinCatalog(adapter, { ttlMs: 60_000 });
      await catalog.isOnJellyfin(1);
      await catalog.isOnJellyfin(1);
      expect(fetchCatalog).toHaveBeenCalledTimes(1);
    });
  });
});
