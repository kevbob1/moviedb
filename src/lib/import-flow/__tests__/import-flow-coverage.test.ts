import { TmdbClient } from '@/lib/tmdb';
import { createImportFlow } from '../index';
import { searchCatalog } from '../search';

const series = { id: 2, name: 'A Show', overview: 'show overview', poster_path: '/show.jpg', first_air_date: '2023-01-01' };

function tmdbWith(results: unknown[], tvDetails: jest.Mock = jest.fn()): TmdbClient {
  return {
    searchMovies: jest.fn().mockResolvedValue({ page: 1, results, total_pages: 1, total_results: results.length }),
    searchTV: jest.fn().mockResolvedValue({ page: 1, results, total_pages: 1, total_results: results.length }),
    tvDetails,
  } as unknown as TmdbClient;
}

describe('searchCatalog coverage edges', () => {
  it('surfaces a season-catalog error on the availability summary', async () => {
    const result = await searchCatalog(
      tmdbWith([series]),
      {
        availabilityFor: jest.fn().mockResolvedValue({ 2: { available: false, configured: true } }),
        seasonsForMany: jest.fn().mockResolvedValue({
          2: { seasons: [1], configured: true, error: 'season catalog down' },
        }),
      },
      jest.fn().mockResolvedValue([]),
      'show',
      'tv',
    );

    expect(result.availability).toEqual({ configured: true, error: 'season catalog down' });
  });

  it('reports a non-Error availability rejection as text', async () => {
    const result = await searchCatalog(
      tmdbWith([series]),
      {
        availabilityFor: jest.fn().mockRejectedValue('jellyfin offline'),
        seasonsForMany: jest.fn(),
      },
      jest.fn().mockResolvedValue([]),
      'show',
      'tv',
    );

    expect(result.availability).toEqual({ configured: false, error: 'jellyfin offline' });
  });

  it('reports a non-Error season read rejection per result', async () => {
    const result = await searchCatalog(
      tmdbWith([series]),
      {
        availabilityFor: jest.fn().mockResolvedValue({ 2: { available: false, configured: true } }),
        seasonsForMany: jest.fn().mockResolvedValue({ 2: { seasons: [], configured: true } }),
      },
      jest.fn().mockRejectedValue('tmdb exploded'),
      'show',
      'tv',
    );

    expect(result.items[0].seasonError).toBe('tmdb exploded');
  });
});

describe('requestImport coverage edges', () => {
  it('defaults a missing title and empty season rows for a movie', async () => {
    const requestService = {
      createRequest: jest.fn().mockResolvedValue({}),
      createTvRequests: jest.fn().mockResolvedValue([]),
    };
    const flow = createImportFlow({
      tmdb: tmdbWith([]),
      jellyfin: {
        availabilityFor: jest.fn().mockResolvedValue({ 9: { available: true, configured: true } }),
        seasonsForMany: jest.fn().mockResolvedValue({}),
      },
      requestService,
    });

    const imported = await flow.requestImport(
      { id: 9, overview: null, poster_path: null, genre_ids: [], mediaType: 'movie' } as never,
      0,
      'alice',
    );

    expect(requestService.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ tmdbId: 9, title: '', mediaType: 'movie' }),
    );
    expect(imported.seasonRows).toEqual([]);
  });

  it('fans a TV import out to every season without a season filter', async () => {
    const requestService = {
      createRequest: jest.fn().mockResolvedValue({}),
      createTvRequests: jest.fn().mockResolvedValue([]),
    };
    const flow = createImportFlow({
      tmdb: tmdbWith([]),
      jellyfin: {
        availabilityFor: jest.fn().mockResolvedValue({ 2: { available: false, configured: true } }),
        seasonsForMany: jest.fn().mockResolvedValue({}),
      },
      requestService,
    });

    await flow.requestImport(
      { ...series, mediaType: 'tv', genre_ids: [] } as never,
      'all',
      'alice',
    );

    expect(requestService.createTvRequests).toHaveBeenCalledWith(2, 'alice');
    expect(requestService.createRequest).not.toHaveBeenCalled();
  });
});
