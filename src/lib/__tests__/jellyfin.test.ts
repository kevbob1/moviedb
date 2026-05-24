describe('Jellyfin library', () => {
  beforeEach(() => {
    delete process.env.JELLYFIN_URL;
    delete process.env.JELLYFIN_API_KEY;
  });

  describe('isMovieOnJellyfin', () => {
    it('returns false when JELLYFIN_URL is missing', async () => {
      process.env.JELLYFIN_API_KEY = 'test-key';
      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('returns false when JELLYFIN_API_KEY is missing', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('queries correctly formed URL with TMDB ID', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';
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
    });

    it('returns true when Jellyfin returns results', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Items: [
            { id: '1', Name: 'Test Movie', ProviderIds: { tmdb: '123' } }
          ]
        })
      });

      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(true);
    });

    it('returns false when Jellyfin returns empty results', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Items: [] })
      });

      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('returns false on non-2xx response', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

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
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Items: [
            { id: '1', ProviderIds: { tmdb: '123' } },
            { id: '2', ProviderIds: { tmdb: '456' } }
          ]
        })
      });

      const result = await areMoviesOnJellyfin([123, 456, 789]);
      expect(result.get(123)).toBe(true);
      expect(result.get(456)).toBe(true);
      expect(result.get(789)).toBe(false);
    });

    it('returns false for all IDs when JELLYFIN_URL is missing', async () => {
      const result = await areMoviesOnJellyfin([123, 456]);
      expect(result.get(123)).toBe(false);
      expect(result.get(456)).toBe(false);
    });
  });
});
