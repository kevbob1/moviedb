import { TmdbError, TmdbClient } from '@/lib/tmdb';
import { createImportFlow, ImportResult } from '../index';

const movie = { id: 1, title: 'A Movie', overview: 'overview', poster_path: '/movie.jpg', release_date: '2024-01-02' };
const series = { id: 2, name: 'A Show', overview: 'show overview', poster_path: '/show.jpg', first_air_date: '2023-01-01' };
const details = {
  id: 2,
  name: 'A Show',
  seasons: [
    { season_number: 0, name: 'Specials', episode_count: 1, poster_path: null },
    { season_number: 1, name: 'Season 1', episode_count: 8, poster_path: null },
    { season_number: 2, name: 'Season 2', episode_count: 8, poster_path: null },
  ],
};

function makeFlow(overrides: Partial<TmdbClient> = {}) {
  const tmdb: TmdbClient = {
    searchMovies: jest.fn().mockResolvedValue({ page: 1, results: [movie], total_pages: 1, total_results: 1 }),
    searchTV: jest.fn().mockResolvedValue({ page: 1, results: [series], total_pages: 1, total_results: 1 }),
    tvDetails: jest.fn().mockResolvedValue(details),
    ...overrides,
  };
  const jellyfin = {
    availabilityFor: jest.fn().mockResolvedValue({ 1: { available: true, configured: true }, 2: { available: false, configured: true } }),
    seasonsForMany: jest.fn().mockResolvedValue({ 2: { seasons: [1], configured: true } }),
  };
  const requestService = { createRequest: jest.fn().mockResolvedValue({}), createTvRequests: jest.fn().mockResolvedValue([]) };
  return { flow: createImportFlow({ tmdb, jellyfin, requestService }), tmdb, jellyfin, requestService };
}

test('fans in movie search and embeds availability', async () => {
  const { flow } = makeFlow();
  await expect(flow.search('movie', 'movie')).resolves.toEqual({
    items: [{ ...movie, mediaType: 'movie', onJellyfin: true, availableSeasons: [], missingSeasons: [] }],
    availability: { configured: true, error: null },
  });
});

test('fans in tv search and lazily loads seasons with regular-season missing derivation', async () => {
  const { flow, tmdb } = makeFlow();
  const result = await flow.search('show', 'tv');
  expect(result.items[0]).toMatchObject({ ...series, mediaType: 'tv', onJellyfin: false, availableSeasons: [1], missingSeasons: [] });
  expect(result.items[0]).toHaveProperty('allSeasons', []);
  expect(tmdb.tvDetails).not.toHaveBeenCalled();
  await expect(flow.seasonsFor(2)).resolves.toEqual(details.seasons);
  await expect(flow.seasonsFor(2)).resolves.toEqual(details.seasons);
  expect(tmdb.tvDetails).toHaveBeenCalledTimes(1);
});

test('propagates TMDB errors and softly degrades Jellyfin', async () => {
  const { flow } = makeFlow({ searchMovies: jest.fn().mockRejectedValue(new TmdbError('TMDB down')) });
  await expect(flow.search('x', 'movie')).rejects.toThrow(TmdbError);

  const degraded = makeFlow();
  degraded.jellyfin.availabilityFor.mockRejectedValue(new Error('catalog unavailable'));
  await expect(degraded.flow.search('x', 'movie')).resolves.toMatchObject({
    items: [{ onJellyfin: false }],
    availability: { configured: false, error: 'catalog unavailable' },
  });
});

test('requestImport handles movie, all seasons, and one season then re-projects', async () => {
  const { flow, jellyfin, requestService } = makeFlow();
  const movieResult = (await flow.search('x', 'movie')).items[0];
  await flow.requestImport(movieResult, 3, 'Ada');
  expect(requestService.createRequest).toHaveBeenCalledWith(expect.objectContaining({ tmdbId: 1, mediaType: 'movie', requestedBy: 'Ada' }));

  const tvResult: ImportResult = { ...((await flow.search('x', 'tv')).items[0]), allSeasons: details.seasons };
  const refreshed = await flow.requestImport(tvResult, 'all', 'Ada');
  expect(refreshed).toMatchObject({ availableSeasons: [1], missingSeasons: [2] });
  await flow.requestImport(tvResult, 2, 'Ada');
  expect(requestService.createTvRequests).toHaveBeenCalledWith(2, 'Ada');
  expect(requestService.createRequest).toHaveBeenCalledWith(expect.objectContaining({ tmdbId: 2, mediaType: 'tv', seasonNumber: 2 }));
  expect(jellyfin.availabilityFor).toHaveBeenCalled();
  expect(jellyfin.seasonsForMany).toHaveBeenCalled();
});

test('excludes specials from missing seasons', async () => {
  const { flow } = makeFlow();
  const result = await flow.search('show', 'tv');
  expect(result.items[0].missingSeasons).not.toContain(0);
  expect(result.items[0].missingSeasons).toEqual([]);
});

test('softly degrades when Jellyfin season lookup fails', async () => {
  const setup = makeFlow();
  setup.jellyfin.seasonsForMany.mockRejectedValue(new Error('season catalog unavailable'));
  await expect(setup.flow.search('show', 'tv')).resolves.toMatchObject({
    availability: { configured: false, error: 'season catalog unavailable' },
    items: [{ onJellyfin: false, availableSeasons: [], missingSeasons: [] }],
  });
});

test('refreshes availability after request when Jellyfin changes', async () => {
  const setup = makeFlow();
  setup.jellyfin.availabilityFor
    .mockResolvedValueOnce({ 1: { available: false, configured: true } })
    .mockResolvedValueOnce({ 1: { available: true, configured: true } });
  const result = (await setup.flow.search('movie', 'movie')).items[0];
  expect(result.onJellyfin).toBe(false);
  await setup.flow.requestImport(result, 'all', 'Ada');
  await expect(setup.flow.requestImport(result, 'all', 'Ada')).resolves.toMatchObject({ onJellyfin: true });
});

test('returns null when TV details rejects', async () => {
  const { flow } = makeFlow({ tvDetails: jest.fn().mockRejectedValue(new Error('details unavailable')) });
  await expect(flow.seasonsFor(2)).resolves.toBeNull();
});

test('converts non-Error Jellyfin failures into a degradation message', async () => {
  const setup = makeFlow();
  setup.jellyfin.availabilityFor.mockRejectedValue('catalog unavailable');
  await expect(setup.flow.search('x', 'movie')).resolves.toMatchObject({
    availability: { configured: false, error: 'catalog unavailable' },
  });
});
