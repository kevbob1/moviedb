import { logger } from '@/lib/logger';

const findManyMock = jest.fn();
const sendDailySummaryMock = jest.fn();
const headersMock = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    request: {
      findMany: findManyMock,
    },
  },
}));

jest.mock('@/lib/notifications', () => ({
  sendDailySummary: (...args: unknown[]) => sendDailySummaryMock(...args),
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

describe('daily-summary cron API', () => {
  const mockRequest = { url: 'http://localhost/api/cron/daily-summary', method: 'GET' } as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CRON_SECRET;
    headersMock.mockResolvedValue(new Headers());
    sendDailySummaryMock.mockResolvedValue(undefined);
    findManyMock.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
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
    it('returns 200 with count of requests', async () => {
      findManyMock.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('count', 2);
    });

    it('returns 200 with status skipped when no active requests', async () => {
      findManyMock.mockResolvedValue([]);

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('skipped');
      expect(body).toHaveProperty('count', 0);
      expect(sendDailySummaryMock).not.toHaveBeenCalled();
    });

    it('queries for pending and downloading requests', async () => {
      await GET(mockRequest);

      expect(findManyMock).toHaveBeenCalledWith({
        where: { status: { in: ['pending', 'downloading'] } },
        orderBy: { requested_at: 'desc' },
      });
    });

    it('passes requests to sendDailySummary', async () => {
      const requests = [{ id: 1 }, { id: 2 }];
      findManyMock.mockResolvedValue(requests);

      await GET(mockRequest);

      expect(sendDailySummaryMock).toHaveBeenCalledWith(requests);
    });
  });

  describe('error handling', () => {
    it('returns 500 when findMany throws', async () => {
      findManyMock.mockRejectedValue(new Error('DB error'));

      const response = await GET(mockRequest);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.status).toBe('error');
      expect(body).toHaveProperty('message', 'Daily summary failed');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'DB error' }),
        'Daily summary cron failed'
      );
    });

    it('returns 500 when sendDailySummary throws', async () => {
      findManyMock.mockResolvedValue([{ id: 1 }]);
      sendDailySummaryMock.mockRejectedValue(new Error('SMTP error'));

      const response = await GET(mockRequest);
      expect(response.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'SMTP error' }),
        'Daily summary cron failed'
      );
    });
  });
});

export {};
