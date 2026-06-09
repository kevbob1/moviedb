import { GET } from '../route';

jest.mock('@/lib/tmdb', () => ({
  searchTMDBMovies: jest.fn(),
  searchTMDBTV: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TMDB Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches movies when type is movie', async () => {
    const searchTMDBMovies = jest.requireMock('@/lib/tmdb').searchTMDBMovies;
    searchTMDBMovies.mockResolvedValue([{ id: 1, title: 'Movie' }]);

    const req = { url: 'http://localhost/api/tmdb/search?q=test&type=movie', method: 'GET' } as unknown as Request;
    const res = await GET(req);
    const data = await res.json();

    expect(searchTMDBMovies).toHaveBeenCalledWith('test');
    expect(data.results).toEqual([{ id: 1, title: 'Movie' }]);
  });

  it('searches tv when type is tv', async () => {
    const searchTMDBTV = jest.requireMock('@/lib/tmdb').searchTMDBTV;
    searchTMDBTV.mockResolvedValue([{ id: 100, name: 'Show' }]);

    const req = { url: 'http://localhost/api/tmdb/search?q=test&type=tv', method: 'GET' } as unknown as Request;
    const res = await GET(req);
    const data = await res.json();

    expect(searchTMDBTV).toHaveBeenCalledWith('test');
    expect(data.results).toEqual([{ id: 100, name: 'Show' }]);
  });

  it('defaults to movie when type is missing', async () => {
    const searchTMDBMovies = jest.requireMock('@/lib/tmdb').searchTMDBMovies;
    searchTMDBMovies.mockResolvedValue([]);

    const req = { url: 'http://localhost/api/tmdb/search?q=test', method: 'GET' } as unknown as Request;
    const res = await GET(req);
    const data = await res.json();

    expect(searchTMDBMovies).toHaveBeenCalledWith('test');
    expect(data.results).toEqual([]);
  });

  it('returns empty results when query is empty', async () => {
    const req = { url: 'http://localhost/api/tmdb/search?q=  ', method: 'GET' } as unknown as Request;
    const res = await GET(req);
    const data = await res.json();

    expect(data.results).toEqual([]);
  });
});
