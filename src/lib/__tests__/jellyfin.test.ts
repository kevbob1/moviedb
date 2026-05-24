import { isMovieOnJellyfin, areMoviesOnJellyfin, checkMovieOnJellyfin, checkMoviesOnJellyfin } from '../jellyfin';

describe('Jellyfin library', () => {
const originalEnv = process.env;

beforeEach(() => {
jest.clearAllMocks();
if (typeof global.fetch !== 'function' || !(global.fetch as jest.Mock).mock) {
  global.fetch = jest.fn();
}
process.env.JELLYFIN_URL = 'http://localhost:8096';
process.env.JELLYFIN_API_KEY = 'test-key';
});

afterEach(() => {
process.env = originalEnv;
});

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
  expect(result.results).toEqual({});
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

it('returns movie availability when successful', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
ok: true,
json: async () => ({
  Items: [{ id: '1', ProviderIds: { tmdb: '123' } }]
})
  } as unknown as Response);

  const result = await checkMovieOnJellyfin(123);
  expect(result.results[123]).toBe(true);
  expect(result.configured).toBe(true);
  expect(result.error).toBeUndefined();
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
  (global.fetch as jest.Mock).mockResolvedValueOnce({
ok: true,
json: async () => ({
  Items: [
  { id: '1', ProviderIds: { tmdb: '123' } },
  { id: '2', ProviderIds: { tmdb: '456' } }
  ]
})
  } as unknown as Response);

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
  expect(result.configured).toBe(false);
  expect(result.error).toContain('Network error');
});

it('returns true when Jellyfin returns results', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
ok: true,
json: async () => ({
  Items: [
  { id: '1', Name: 'Test Movie', ProviderIds: { tmdb: '123' } }
  ]
})
  } as unknown as Response);

  const result = await isMovieOnJellyfin(123);
  expect(result.available).toBe(true);
  expect(result.configured).toBe(true);
});

it('returns false when Jellyfin returns empty results', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
ok: true,
json: async () => ({ Items: [] })
  } as unknown as Response);

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

it('makes single call for multiple IDs and returns map', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
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
