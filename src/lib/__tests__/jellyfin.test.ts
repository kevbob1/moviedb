import { jest } from '@jest/globals';

describe('Jellyfin library', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env.JELLYFIN_URL = 'http://localhost:8096';
    process.env.JELLYFIN_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isMovieOnJellyfin', () => {
    it('returns false when JELLYFIN_URL is missing', async () => {
      delete process.env.JELLYFIN_URL;
      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('returns false when JELLYFIN_API_KEY is missing', async () => {
      delete process.env.JELLYFIN_API_KEY;
      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('queries correctly formed URL with TMDB ID', async () => {
      const mockFetch = jest.spyOn(global, 'fetch') as jest.Mock;

      await isMovieOnJellyfin(123);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8096/Items?AnyProviderIdEquals=tmdb.123&IncludeItemTypes=Movie',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'MediaBrowser Token="test-key"'
          })
        })
      );

      mockFetch.mockRestore();
    });

    it('returns true when Jellyfin returns results', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Items: [
            { id: '1', Name: 'Test Movie', ProviderIds: { tmdb: '123' } }
          ]
        })
      } as unknown as Response);

      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(true);
    });

    it('returns false when Jellyfin returns empty results', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Items: [] })
      } as unknown as Response);

      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(new Error('Network error'));

      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('returns false on non-2xx response', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 500
      } as unknown as Response);

      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });
  });

  describe('areMoviesOnJellyfin', () => {
    it('returns empty map when no IDs provided', async () => {
      const result = await areMoviesOnJellyfin([]);
      expect(result).toEqual(new Map());
    });

    it('makes single call for multiple IDs and returns map', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Items: [
            { id: '1', ProviderIds: { tmdb: '123' } },
            { id: '2', ProviderIds: { tmdb: '456' } }
          ]
        })
      } as unknown as Response);

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
});
