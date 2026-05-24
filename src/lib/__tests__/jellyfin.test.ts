import { isMovieOnJellyfin, areMoviesOnJellyfin, checkMovieOnJellyfin, checkMoviesOnJellyfin, invalidateJellyfinCache } from '../jellyfin';

describe('Jellyfin library', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateJellyfinCache();
    if (typeof global.fetch !== 'function' || !(global.fetch as jest.Mock).mock) {
      global.fetch = jest.fn();
    }
    process.env.JELLYFIN_URL = 'http://localhost:8096';
    process.env.JELLYFIN_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function mockJellyfinMoviesResponse(movies: { tmdb: string }[]) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Items: movies.map(m => ({ ProviderIds: { Tmdb: m.tmdb } })),
        TotalRecordCount: movies.length
      })
    } as unknown as Response);
  }

  describe('checkMovieOnJellyfin', () => {
    it('returns error when movie ID is invalid', async () => {
      const result = await checkMovieOnJellyfin(0);
      expect(result.results).toEqual({});
      expect(result.configured).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns configured:false when JELLYFIN_URL is missing', async () => {
      delete process.env.JELLYFIN_URL;
      const result = await checkMovieOnJellyfin(123);
      expect(result.configured).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('returns configured:false when API returns error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as unknown as Response);

      const result = await checkMovieOnJellyfin(123);
      expect(result.configured).toBe(false);
      expect(result.error).toContain('Jellyfin API error');
    });

    it('returns movie availability when movie exists', async () => {
      mockJellyfinMoviesResponse([{ tmdb: '123' }, { tmdb: '456' }]);

      const result = await checkMovieOnJellyfin(123);
      expect(result.results[123]).toBe(true);
      expect(result.configured).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns false when movie does not exist', async () => {
      mockJellyfinMoviesResponse([{ tmdb: '456' }]);

      const result = await checkMovieOnJellyfin(123);
      expect(result.results[123]).toBe(false);
      expect(result.configured).toBe(true);
    });
  });

  describe('checkMoviesOnJellyfin', () => {
    it('returns empty results when no IDs provided', async () => {
      const result = await checkMoviesOnJellyfin([]);
      expect(result.results).toEqual({});
      expect(result.configured).toBe(false);
    });

    it('returns configured:false when JELLYFIN_URL is missing', async () => {
      delete process.env.JELLYFIN_URL;
      const result = await checkMoviesOnJellyfin([123, 456]);
      expect(result.results[123]).toBe(false);
      expect(result.results[456]).toBe(false);
      expect(result.configured).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('returns configured:false on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      } as unknown as Response);

      const result = await checkMoviesOnJellyfin([123, 456]);
      expect(result.configured).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns availability for multiple movies', async () => {
      mockJellyfinMoviesResponse([{ tmdb: '123' }, { tmdb: '456' }]);

      const result = await checkMoviesOnJellyfin([123, 456, 789]);
      expect(result.results[123]).toBe(true);
      expect(result.results[456]).toBe(true);
      expect(result.results[789]).toBe(false);
      expect(result.configured).toBe(true);
    });
  });

  describe('isMovieOnJellyfin', () => {
    it('returns configured:false when JELLYFIN_URL is missing', async () => {
      delete process.env.JELLYFIN_URL;
      const result = await isMovieOnJellyfin(123);
      expect(result.available).toBe(false);
      expect(result.configured).toBe(false);
    });

    it('returns configured:false when JELLYFIN_API_KEY is missing', async () => {
      delete process.env.JELLYFIN_API_KEY;
      const result = await isMovieOnJellyfin(123);
      expect(result.available).toBe(false);
      expect(result.configured).toBe(false);
    });

    it('returns error message on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await isMovieOnJellyfin(123);
      expect(result.available).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('returns true when movie exists in Jellyfin', async () => {
      mockJellyfinMoviesResponse([{ tmdb: '123' }]);

      const result = await isMovieOnJellyfin(123);
      expect(result.available).toBe(true);
      expect(result.configured).toBe(true);
    });

    it('returns false when movie does not exist in Jellyfin', async () => {
      mockJellyfinMoviesResponse([{ tmdb: '456' }]);

      const result = await isMovieOnJellyfin(123);
      expect(result.available).toBe(false);
      expect(result.configured).toBe(true);
    });
  });

  describe('areMoviesOnJellyfin', () => {
    it('returns empty map when no IDs provided', async () => {
      const result = await areMoviesOnJellyfin([]);
      expect(result).toEqual(new Map());
    });

    it('returns availability from Jellyfin movie list', async () => {
      mockJellyfinMoviesResponse([{ tmdb: '123' }, { tmdb: '456' }]);

      const result = await areMoviesOnJellyfin([123, 456, 789]);
      expect(result.get(123)).toBe(true);
      expect(result.get(456)).toBe(true);
      expect(result.get(789)).toBe(false);
    });

    it('returns false for all IDs when JELLYFIN_URL is missing', async () => {
      delete process.env.JELLYFIN_URL;
      const result = await areMoviesOnJellyfin([123, 456]);
      expect(result.get(123)).toBe(false);
      expect(result.get(456)).toBe(false);
    });
  });

  describe('caching', () => {
    it('caches Jellyfin results across calls', async () => {
      mockJellyfinMoviesResponse([{ tmdb: '123' }, { tmdb: '456' }]);

      const result1 = await areMoviesOnJellyfin([123]);
      expect(result1.get(123)).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const result2 = await areMoviesOnJellyfin([456]);
      expect(result2.get(456)).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('invalidates cache when invalidateJellyfinCache is called', async () => {
      mockJellyfinMoviesResponse([{ tmdb: '123' }]);

      await areMoviesOnJellyfin([123]);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      invalidateJellyfinCache();

      mockJellyfinMoviesResponse([{ tmdb: '123' }, { tmdb: '456' }]);

      const result = await areMoviesOnJellyfin([456]);
      expect(result.get(456)).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
