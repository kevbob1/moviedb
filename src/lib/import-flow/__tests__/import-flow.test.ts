import { TmdbError, TmdbClient } from '@/lib/tmdb';
import { createImportFlow } from '../index';

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
  const { flow, tmdb } = makeFlow();
  await expect(flow.search('movie', 'movie')).resolves.toEqual({
    items: [{
      ...movie,
      mediaType: 'movie',
      onJellyfin: true,
      seasonRows: [],
      seasonError: null,
    }],
    availability: { configured: true, error: null },
  });
  expect(tmdb.tvDetails).not.toHaveBeenCalled();
});

test('returns TV seasons with availability already decided, specials excluded', async () => {
  const { flow } = makeFlow();
  const result = await flow.search('show', 'tv');

  expect(result.items[0]).toMatchObject({ ...series, mediaType: 'tv', onJellyfin: false, seasonError: null });
  expect(result.items[0].seasonRows).toEqual([
    { season: details.seasons[1], available: true },
    { season: details.seasons[2], available: false },
  ]);
  expect(result.items[0].seasonRows.map((row) => row.season.season_number)).not.toContain(0);
});

test('costs one TMDB season read per result, cached across searches', async () => {
  const { flow, tmdb } = makeFlow();
  await flow.search('show', 'tv');
  await flow.search('show', 'tv');

  expect(tmdb.tvDetails).toHaveBeenCalledTimes(1);
});

test('degrades one result whose seasons cannot be read without failing the search', async () => {
  const { flow } = makeFlow({ tvDetails: jest.fn().mockRejectedValue(new Error('details unavailable')) });
  const result = await flow.search('show', 'tv');

  expect(result.items[0].seasonRows).toEqual([]);
  expect(result.items[0].seasonError).toBe('details unavailable');
  expect(result.availability).toEqual({ configured: true, error: null });
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

  const tvResult = (await flow.search('x', 'tv')).items[0];
  const refreshed = await flow.requestImport(tvResult, 'all', 'Ada');
  expect(refreshed.seasonRows).toEqual([
    { season: details.seasons[1], available: true },
    { season: details.seasons[2], available: false },
  ]);
  await flow.requestImport(tvResult, 2, 'Ada');
  expect(requestService.createTvRequests).toHaveBeenCalledWith(2, 'Ada');
  expect(requestService.createRequest).toHaveBeenCalledWith(expect.objectContaining({ tmdbId: 2, mediaType: 'tv', seasonNumber: 2 }));
  expect(jellyfin.availabilityFor).toHaveBeenCalled();
  expect(jellyfin.seasonsForMany).toHaveBeenCalled();
});

test('projects every season as available once Jellyfin has them', async () => {
  const setup = makeFlow();
  setup.jellyfin.seasonsForMany.mockResolvedValue({ 2: { seasons: [1, 2], configured: true } });
  const result = await setup.flow.search('show', 'tv');

  expect(result.items[0].seasonRows.map((row) => [row.season.season_number, row.available])).toEqual([
    [1, true],
    [2, true],
  ]);
});

test('softly degrades when Jellyfin season lookup fails', async () => {
  const setup = makeFlow();
  setup.jellyfin.seasonsForMany.mockRejectedValue(new Error('season catalog unavailable'));
  const result = await setup.flow.search('show', 'tv');

  // The seasons themselves are still known from TMDB; what is lost is which
  // ones Jellyfin already has, so every row reads as not available.
  expect(result.availability).toEqual({ configured: false, error: 'season catalog unavailable' });
  expect(result.items[0].seasonRows.map((row) => [row.season.season_number, row.available])).toEqual([
    [1, false],
    [2, false],
  ]);
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

test('converts non-Error Jellyfin failures into a degradation message', async () => {
  const setup = makeFlow();
  setup.jellyfin.availabilityFor.mockRejectedValue('catalog unavailable');
  await expect(setup.flow.search('x', 'movie')).resolves.toMatchObject({
    availability: { configured: false, error: 'catalog unavailable' },
  });
});
