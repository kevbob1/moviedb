import { createJellyfinCatalog } from '../catalog';
import type { JellyfinAdapter } from '../adapter';

function erroringAdapter(error = 'Jellyfin not configured'): JellyfinAdapter {
  return {
    fetchCatalog: async () => ({ movies: new Set<string>(), seasons: new Map(), error }),
    ping: async () => ({ reachable: false, error }),
  };
}

describe('jellyfin catalog coverage edges', () => {
  it('reports the configuration error on availability reads', async () => {
    const catalog = createJellyfinCatalog(erroringAdapter());

    await expect(catalog.availabilityFor([1, 2])).resolves.toEqual({
      1: { available: false, configured: false, error: 'Jellyfin not configured' },
      2: { available: false, configured: false, error: 'Jellyfin not configured' },
    });
    await expect(catalog.seasonsForMany([1])).resolves.toEqual({
      1: { seasons: [], configured: false, error: 'Jellyfin not configured' },
    });
    await expect(catalog.ping()).resolves.toEqual({
      configured: false,
      reachable: false,
      error: 'Jellyfin not configured',
    });
  });

  it('sorts season numbers and reports a configured catalog', async () => {
    const catalog = createJellyfinCatalog({
      fetchCatalog: async () => ({
        movies: new Set(['5']),
        seasons: new Map([['5', new Set([3, 1, 2])]]),
      }),
      ping: async () => ({ reachable: true }),
    });

    await expect(catalog.isOnJellyfin(5)).resolves.toEqual({
      available: true,
      configured: true,
    });
    await expect(catalog.seasonsFor(5)).resolves.toEqual({
      seasons: [1, 2, 3],
      configured: true,
    });
    await expect(catalog.ping()).resolves.toEqual({
      configured: true,
      reachable: true,
    });
  });
});
