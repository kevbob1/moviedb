interface MockResponse {
  ok: boolean;
  status: number;
  json(): Promise<{ status: string; database?: string; jellyfin?: string }>;
  headers: Map<string, string>;
}

const prismaQueryRawMock = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: prismaQueryRawMock,
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockJellyfinFn = jest.fn();

jest.mock('@/lib/jellyfin', () => {
  const actual = jest.requireActual('@/lib/jellyfin');
  return {
    ...actual,
    ping: (...args: unknown[]) => mockJellyfinFn(...args),
  };
});

let GET: (req: Request) => Promise<MockResponse>;

beforeAll(() => {
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../readiness/route');
    GET = route.GET;
  });
});

describe('readiness API', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJellyfinFn.mockReset();
    process.env.JELLYFIN_URL = 'http://localhost:8096';
    process.env.JELLYFIN_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('database connectivity', () => {
    it('returns 503 when database query fails', async () => {
      prismaQueryRawMock.mockRejectedValueOnce(new Error('DB connection failed'));
      mockJellyfinFn.mockResolvedValueOnce({ configured: true, reachable: true });

      const response = await GET!({ url: 'http://localhost:3000/api/health/readiness', method: 'GET' } as unknown as Request);
      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.status).toBe('error');
      expect(body.database).toBe('error');
    });

    it('returns 200 when database is connected', async () => {
      prismaQueryRawMock.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockJellyfinFn.mockResolvedValueOnce({ configured: true, reachable: true });

      const response = await GET!({ url: 'http://localhost:3000/api/health/readiness', method: 'GET' } as unknown as Request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.database).toBe('ok');
    });
  });

  describe('jellyfin connectivity', () => {
    it('returns 200 when jellyfin is configured and reachable', async () => {
      prismaQueryRawMock.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockJellyfinFn.mockResolvedValueOnce({ configured: true, reachable: true });

      const response = await GET!({ url: 'http://localhost:3000/api/health/readiness', method: 'GET' } as unknown as Request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.jellyfin).toBe('ok');
    });

    it('returns 200 when jellyfin is not configured', async () => {
      delete process.env.JELLYFIN_URL;
      delete process.env.JELLYFIN_API_KEY;
      prismaQueryRawMock.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockJellyfinFn.mockResolvedValueOnce({ configured: false, reachable: false, error: 'Jellyfin not configured' });

      const response = await GET!({ url: 'http://localhost:3000/api/health/readiness', method: 'GET' } as unknown as Request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.jellyfin).toBe('not_configured');
    });

    it('returns 503 when jellyfin is configured but unreachable', async () => {
      prismaQueryRawMock.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockJellyfinFn.mockResolvedValueOnce({ configured: true, reachable: false, error: 'Connection refused' });

      const response = await GET!({ url: 'http://localhost:3000/api/health/readiness', method: 'GET' } as unknown as Request);
      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.status).toBe('error');
      expect(body.jellyfin).toBe('error');
    });
  });

  describe('combined checks', () => {
    it('returns 503 when db is ok but jellyfin is unreachable', async () => {
      prismaQueryRawMock.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockJellyfinFn.mockResolvedValueOnce({ configured: true, reachable: false, error: 'Jellyfin API error: 500' });

      const response = await GET!({ url: 'http://localhost:3000/api/health/readiness', method: 'GET' } as unknown as Request);
      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.database).toBe('ok');
      expect(body.jellyfin).toBe('error');
    });

    it('returns 503 when db is unreachable regardless of jellyfin status', async () => {
      prismaQueryRawMock.mockRejectedValueOnce(new Error('connection refused'));
      mockJellyfinFn.mockResolvedValueOnce({ configured: true, reachable: true });

      const response = await GET!({ url: 'http://localhost:3000/api/health/readiness', method: 'GET' } as unknown as Request);
      expect(response.status).toBe(503);
    });

    it('returns 200 when both db and jellyfin are healthy', async () => {
      prismaQueryRawMock.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockJellyfinFn.mockResolvedValueOnce({ configured: true, reachable: true });

      const response = await GET!({ url: 'http://localhost:3000/api/health/readiness', method: 'GET' } as unknown as Request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.database).toBe('ok');
      expect(body.jellyfin).toBe('ok');
    });
  });
});

export {};
