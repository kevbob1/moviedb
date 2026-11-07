import { HttpJellyfinAdapter } from '../adapter';

describe('HttpJellyfinAdapter coverage edges', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it('treats a response without Items as an empty catalog', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ TotalRecordCount: 0 }),
    } as unknown as Response);

    const adapter = new HttpJellyfinAdapter({ url: 'http://jellyfin:8096', apiKey: 'key' });

    await expect(adapter.fetchCatalog()).resolves.toEqual({
      movies: new Set(),
      seasons: new Map(),
    });
  });

  it('skips items with no resolvable TMDB id and maps series ids onto seasons', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        Items: [
          { Id: 'series-1', Type: 'Series', ProviderIds: { Tmdb: '42' } },
          { Id: 'season-1', Type: 'Season', SeriesId: 'series-1', IndexNumber: 2 },
          { Id: 'season-2', Type: 'Season', SeriesId: 'series-1', IndexNumber: 1 },
          { Id: 'orphan', Type: 'Season', IndexNumber: 9 },
          { Id: 'movie-1', Type: 'Movie', ProviderIds: { Tmdb: '7' } },
        ],
        TotalRecordCount: 5,
      }),
    } as unknown as Response);

    const adapter = new HttpJellyfinAdapter({ url: 'http://jellyfin:8096', apiKey: 'key' });
    const catalog = await adapter.fetchCatalog();

    expect(catalog.movies).toEqual(new Set(['42', '7']));
    expect(catalog.seasons.get('42')).toEqual(new Set([2, 1]));
    expect(catalog.error).toBeUndefined();
  });

  it('reports a non-Error catalog failure as a network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce('offline');

    const adapter = new HttpJellyfinAdapter({ url: 'http://jellyfin:8096', apiKey: 'key' });

    await expect(adapter.fetchCatalog()).resolves.toEqual({
      movies: new Set(),
      seasons: new Map(),
      error: 'Jellyfin connection failed: Network error',
    });
  });

  it('reports a non-Error ping failure as a network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce('offline');

    const adapter = new HttpJellyfinAdapter({ url: 'http://jellyfin:8096', apiKey: 'key' });

    await expect(adapter.ping()).resolves.toEqual({
      reachable: false,
      error: 'Jellyfin connection failed: Network error',
    });
  });
});
