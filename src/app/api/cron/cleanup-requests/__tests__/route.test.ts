import { logger } from '@/lib/logger';

const deleteManyMock = jest.fn();
const headersMock = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    request: {
      deleteMany: deleteManyMock,
    },
  },
}));

jest.mock('next/headers', () => ({
  headers: () => headersMock(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

interface MockResponse {
  status: number;
  json(): Promise<Record<string, unknown>>;
}

let GET: (req: Request) => Promise<MockResponse>;

beforeAll(() => {
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../route');
    GET = route.GET;
  });
});

describe('cleanup-requests cron API', () => {
  const mockRequest = { url: 'http://localhost/api/cron/cleanup-requests', method: 'GET' } as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.REQUEST_RETENTION_DAYS;
    headersMock.mockResolvedValue(new Headers());
    deleteManyMock.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.REQUEST_RETENTION_DAYS;
  });

  describe('authentication', () => {
    it('allows access when CRON_SECRET is not set', async () => {
      const response = await GET(mockRequest);
      expect(response.status).toBe(200);
    });

    it('returns 401 when CRON_SECRET is set and Authorization header is missing', async () => {
      process.env.CRON_SECRET = 'secret-token';
      headersMock.mockResolvedValue(new Headers());

      const response = await GET(mockRequest);
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('message', 'Unauthorized');
    });

    it('returns 401 when CRON_SECRET is set and Authorization header is wrong', async () => {
      process.env.CRON_SECRET = 'secret-token';
      headersMock.mockResolvedValue(new Headers({ authorization: 'Bearer wrong' }));

      const response = await GET(mockRequest);
      expect(response.status).toBe(401);
    });

    it('allows access when CRON_SECRET matches Authorization header', async () => {
      process.env.CRON_SECRET = 'secret-token';
      headersMock.mockResolvedValue(new Headers({ authorization: 'Bearer secret-token' }));

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);
    });
  });

  describe('successful execution', () => {
    it('returns 200 with deleted count', async () => {
      deleteManyMock.mockResolvedValue({ count: 3 });

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('deleted', 3);
    });

    it('deletes fulfilled requests older than 5 days by default', async () => {
      await GET(mockRequest);

      expect(deleteManyMock).toHaveBeenCalledTimes(1);
      const callArgs = deleteManyMock.mock.calls[0][0];
      expect(callArgs.where.status).toBe('fulfilled');
      expect(callArgs.where.resolved_at).toHaveProperty('lt');
      expect(callArgs.where.resolved_at.lt).toBeInstanceOf(Date);
    });

    it('returns deleted count 0 when no old fulfilled requests exist', async () => {
      const response = await GET(mockRequest);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('deleted', 0);
    });

    it('responds with deleted count and status ok', async () => {
      deleteManyMock.mockResolvedValue({ count: 5 });

      const response = await GET(mockRequest);
      const body = await response.json();

      expect(body.status).toBe('ok');
      expect(body.deleted).toBe(5);
    });
  });

  describe('error handling', () => {
    it('returns 500 when deleteMany throws', async () => {
      deleteManyMock.mockRejectedValue(new Error('DB error'));

      const response = await GET(mockRequest);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.status).toBe('error');
      expect(body).toHaveProperty('message', 'Cleanup failed');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'DB error' }),
        'Cleanup requests cron failed'
      );
    });
  });
});

export {};
