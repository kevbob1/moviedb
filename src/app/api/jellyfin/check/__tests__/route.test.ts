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

jest.mock('@/lib/jellyfin', () => ({
  checkMoviesOnJellyfin: jest.fn(),
  checkSeasonsOnJellyfin: jest.fn(),
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

describe('Jellyfin Check API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns movies availability for movie IDs', async () => {
    const checkMoviesOnJellyfin = jest.requireMock('@/lib/jellyfin').checkMoviesOnJellyfin;
    const checkSeasonsOnJellyfin = jest.requireMock('@/lib/jellyfin').checkSeasonsOnJellyfin;
    checkMoviesOnJellyfin.mockResolvedValue({
      results: { 1: true, 2: false },
      configured: true,
    });
    checkSeasonsOnJellyfin.mockResolvedValue({
      seasons: {},
      configured: true,
    });

    const req = mockReq('http://localhost/api/jellyfin/check?ids=1,2');
    const res = await GET(req);
    const data = await res.json();

    expect(data.results).toEqual({ 1: true, 2: false });
    expect(data.configured).toBe(true);
  });

  it('includes seasons field in response', async () => {
    const checkMoviesOnJellyfin = jest.requireMock('@/lib/jellyfin').checkMoviesOnJellyfin;
    const checkSeasonsOnJellyfin = jest.requireMock('@/lib/jellyfin').checkSeasonsOnJellyfin;
    checkMoviesOnJellyfin.mockResolvedValue({
      results: { 1: false, 2: false },
      configured: true,
    });
    checkSeasonsOnJellyfin.mockResolvedValue({
      seasons: { 1: [1, 2], 2: [1] },
      configured: true,
    });

    const req = mockReq('http://localhost/api/jellyfin/check?ids=1,2');
    const res = await GET(req);
    const data = await res.json();

    expect(data.seasons).toEqual({ 1: [1, 2], 2: [1] });
  });
});
