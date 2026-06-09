import { GET } from '../route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
      status: init?.status ?? 200,
      json: async () => body,
      headers: new Map(Object.entries(init?.headers ?? {})),
    })),
  },
  NextRequest: class {
    url: string;
    method: string;
    constructor(input: string) {
      this.url = input;
      this.method = 'GET';
    }
  },
}));

jest.mock('@/lib/tmdb', () => ({
  getTMDBTVDetails: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const { NextRequest: MockNextRequest } = jest.requireMock('next/server') as {
  NextRequest: new (url: string) => { url: string; method: string };
};

function mockReq(url: string): Request {
  return new MockNextRequest(url) as unknown as Request;
}

describe('TMDB TV Seasons API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns seasons for multiple shows', async () => {
    const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
    getTMDBTVDetails.mockResolvedValueOnce({
      seasons: [
        { season_number: 1, name: 'Season 1', episode_count: 10 },
        { season_number: 2, name: 'Season 2', episode_count: 8 },
      ],
    });
    getTMDBTVDetails.mockResolvedValueOnce({
      seasons: [
        { season_number: 1, name: 'Season 1', episode_count: 22 },
      ],
    });

    const req = mockReq('http://localhost/api/tmdb/tv/seasons?ids=100,200');
    const res = await GET(req);
    const data = await res.json();

    expect(data.seasons).toEqual({
      100: [
        { season_number: 1, name: 'Season 1', episode_count: 10 },
        { season_number: 2, name: 'Season 2', episode_count: 8 },
      ],
      200: [
        { season_number: 1, name: 'Season 1', episode_count: 22 },
      ],
    });
  });

  it('returns error for invalid ids', async () => {
    const req = mockReq('http://localhost/api/tmdb/tv/seasons?ids=invalid');
    const res = await GET(req);
    const data = await res.json();

    expect(data.error).toBe('No valid TV show IDs provided');
    expect(res.status).toBe(400);
  });

  it('handles empty ids', async () => {
    const req = mockReq('http://localhost/api/tmdb/tv/seasons');
    const res = await GET(req);
    const data = await res.json();

    expect(data.error).toBe('No valid TV show IDs provided');
    expect(res.status).toBe(400);
  });

  it('handles individual show errors gracefully', async () => {
    const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
    getTMDBTVDetails.mockRejectedValueOnce(new Error('Not found'));
    getTMDBTVDetails.mockResolvedValueOnce({
      seasons: [{ season_number: 1, name: 'Season 1', episode_count: 10 }],
    });

    const req = mockReq('http://localhost/api/tmdb/tv/seasons?ids=999,100');
    const res = await GET(req);
    const data = await res.json();

    expect(data.seasons[999]).toEqual([]);
    expect(data.seasons[100]).toEqual([
      { season_number: 1, name: 'Season 1', episode_count: 10 },
    ]);
  });
});
