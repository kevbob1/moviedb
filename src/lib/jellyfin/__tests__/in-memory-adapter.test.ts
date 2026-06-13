import { InMemoryJellyfinAdapter } from '../adapter';

describe('InMemoryJellyfinAdapter', () => {
  it('returns movies and seasons provided at construction', async () => {
    const adapter = new InMemoryJellyfinAdapter({
      movies: ['123', '456'],
      seasons: { '100': new Set([1, 2]) },
    });

    const data = await adapter.fetchCatalog();
    expect(data.movies.has('123')).toBe(true);
    expect(data.movies.has('456')).toBe(true);
    expect(data.seasons.get('100')).toEqual(new Set([1, 2]));
    expect(data.error).toBeUndefined();
  });

  it('reports an error from construction', async () => {
    const adapter = new InMemoryJellyfinAdapter({ error: 'Jellyfin not configured' });
    const data = await adapter.fetchCatalog();
    expect(data.movies.size).toBe(0);
    expect(data.error).toBe('Jellyfin not configured');
  });

  it('returns ping result from construction', async () => {
    const adapter = new InMemoryJellyfinAdapter({ ping: { reachable: true } });
    expect(await adapter.ping()).toEqual({ reachable: true });
  });
});
