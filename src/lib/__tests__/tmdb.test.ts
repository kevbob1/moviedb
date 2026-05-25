import { searchTMDBMovies } from '../tmdb';

describe('TMDB library', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    if (typeof global.fetch !== 'function' || !(global.fetch as jest.Mock).mock) {
      global.fetch = jest.fn();
    }
    process.env.TMDB_API_KEY = 'test-tmdb-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function mockSuccessfulResponse(data: unknown) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });
  }

  function mockFailedResponse(status: number, statusText: string = 'Error') {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status,
      statusText,
    });
  }

  describe('searchTMDBMovies', () => {
    it('returns movies on successful search', async () => {
      const mockMovies = [
        { id: 1, title: 'Movie 1', overview: 'Test 1' },
        { id: 2, title: 'Movie 2', overview: 'Test 2' },
      ];
      mockSuccessfulResponse({ results: mockMovies, page: 1, total_pages: 1, total_results: 2 });

      const results = await searchTMDBMovies('test');
      expect(results).toEqual(mockMovies);
    });

    it('throws on API error', async () => {
      mockFailedResponse(401, 'Unauthorized');
      await expect(searchTMDBMovies('test')).rejects.toThrow('TMDB API error: 401 Unauthorized');
    });
  });
});