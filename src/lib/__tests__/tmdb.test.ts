import { searchTMDBMovies, searchTMDBTV, getTMDBTVDetails } from '../tmdb';

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

  describe('searchTMDBTV', () => {
    it('returns shows on successful search', async () => {
      const mockShows = [
        { id: 100, name: 'Show 1', overview: 'Test 1', first_air_date: '2020-01-01' },
        { id: 200, name: 'Show 2', overview: 'Test 2', first_air_date: '2021-06-15' },
      ];
      mockSuccessfulResponse({ results: mockShows, page: 1, total_pages: 1, total_results: 2 });

      const results = await searchTMDBTV('test');
      expect(results).toEqual(mockShows);
    });

    it('throws on API error', async () => {
      mockFailedResponse(401, 'Unauthorized');
      await expect(searchTMDBTV('test')).rejects.toThrow('TMDB API error: 401 Unauthorized');
    });
  });

  describe('getTMDBTVDetails', () => {
    it('returns seasons array', async () => {
      const mockDetails = {
        id: 100,
        name: 'Test Show',
        seasons: [
          { season_number: 1, name: 'Season 1', episode_count: 10, poster_path: '/s1.jpg' },
          { season_number: 2, name: 'Season 2', episode_count: 8, poster_path: null },
          { season_number: 0, name: 'Specials', episode_count: 2, poster_path: null },
        ],
      };
      mockSuccessfulResponse(mockDetails);

      const result = await getTMDBTVDetails(100);
      expect(result.seasons).toHaveLength(3);
      expect(result.seasons[0].season_number).toBe(1);
      expect(result.seasons[1].season_number).toBe(2);
      expect(result.seasons[2].season_number).toBe(0);
    });

    it('throws on API error', async () => {
      mockFailedResponse(404, 'Not Found');
      await expect(getTMDBTVDetails(999)).rejects.toThrow('TMDB API error: 404 Not Found');
    });
  });
});