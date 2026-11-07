import { InMemoryTmdbAdapter } from '../tmdb';

describe('InMemoryTmdbAdapter defaults', () => {
  it('returns empty movie results when no fixtures are supplied', async () => {
    await expect(new InMemoryTmdbAdapter().searchMovies()).resolves.toEqual({
      page: 1,
      results: [],
      total_pages: 0,
      total_results: 0,
    });
  });

  it('returns empty TV results when no fixtures are supplied', async () => {
    await expect(new InMemoryTmdbAdapter().searchTV()).resolves.toEqual({
      page: 1,
      results: [],
      total_pages: 0,
      total_results: 0,
    });
  });
});
