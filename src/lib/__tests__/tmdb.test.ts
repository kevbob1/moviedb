import {
  createTmdbClient,
  InMemoryTmdbAdapter,
  TmdbError,
} from '../tmdb';

describe('TMDB client seam', () => {
  const fetchMock = global.fetch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TMDB_API_KEY;
  });

  it('throws TmdbError when the API key is missing', async () => {
    await expect(createTmdbClient({ fetch: fetchMock }).searchMovies('test'))
      .rejects.toBeInstanceOf(TmdbError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the movie search response from HTTP', async () => {
    const response = { page: 1, results: [{ id: 1, title: 'Dune' }], total_pages: 1, total_results: 1 };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => response });

    await expect(createTmdbClient({ apiKey: 'key', fetch: fetchMock })
      .searchMovies('Dune')).resolves.toEqual(response);
  });

  it('throws TmdbError for non-ok responses', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });

    await expect(createTmdbClient({ apiKey: 'key', fetch: fetchMock }).searchTV('test'))
      .rejects.toMatchObject({ name: 'TmdbError', message: 'TMDB API error: 401 Unauthorized', status: 401 });
  });

  it('reads the environment key when the HTTP adapter is constructed', async () => {
    process.env.TMDB_API_KEY = 'from-env';
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 7, name: 'Show', seasons: [] }) });

    await createTmdbClient({ fetch: fetchMock }).tvDetails(7);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('api_key=from-env'));
  });

  it('serves configured data through the in-memory adapter', async () => {
    const details = { id: 7, name: 'Show', seasons: [] };
    const client = new InMemoryTmdbAdapter({
      movies: { page: 1, results: [{ id: 1, title: 'Movie' }], total_pages: 1, total_results: 1 },
      details: { 7: details },
    });

    await expect(client.searchMovies()).resolves.toMatchObject({ results: [{ title: 'Movie' }] });
    await expect(client.tvDetails(7)).resolves.toEqual(details);
  });
});
