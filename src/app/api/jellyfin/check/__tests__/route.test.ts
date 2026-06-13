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
  availabilityFor: jest.fn(),
  seasonsForMany: jest.fn(),
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
    const availabilityFor = jest.requireMock('@/lib/jellyfin').availabilityFor;
    const seasonsForMany = jest.requireMock('@/lib/jellyfin').seasonsForMany;
    availabilityFor.mockResolvedValue({
      1: { available: true, configured: true },
      2: { available: false, configured: true },
    });
    seasonsForMany.mockResolvedValue({});

    const req = mockReq('http://localhost/api/jellyfin/check?ids=1,2');
    const res = await GET(req);
    const data = await res.json();

    expect(data.results).toEqual({ 1: true, 2: false });
    expect(data.configured).toBe(true);
  });

  it('includes seasons field in response', async () => {
    const availabilityFor = jest.requireMock('@/lib/jellyfin').availabilityFor;
    const seasonsForMany = jest.requireMock('@/lib/jellyfin').seasonsForMany;
    availabilityFor.mockResolvedValue({
      1: { available: false, configured: true },
      2: { available: false, configured: true },
    });
    seasonsForMany.mockResolvedValue({
      1: { seasons: [1, 2], configured: true },
      2: { seasons: [1], configured: true },
    });

    const req = mockReq('http://localhost/api/jellyfin/check?ids=1,2');
    const res = await GET(req);
    const data = await res.json();

    expect(data.seasons).toEqual({ 1: [1, 2], 2: [1] });
  });
});
