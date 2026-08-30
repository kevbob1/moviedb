import { logger } from '@/lib/logger';

const activeRequestsForSummaryMock = jest.fn();
const sendDailySummaryMock = jest.fn();
const headersMock = jest.fn();

jest.mock('@/lib/request-lifecycle', () => ({
  requestService: {
    activeRequestsForSummary: activeRequestsForSummaryMock,
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
  const domainRequest = {
    id: 1,
    title: 'Inception',
    requested_by: 'Alice',
    requested_at: '2026-06-06T10:00:00.000Z',
    status: 'pending',
    release_date: '2010-07-16' as string | undefined,
    media_type: 'movie' as string | undefined,
    season_number: null as number | null | undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CRON_SECRET;
    headersMock.mockResolvedValue(new Headers());
    sendDailySummaryMock.mockResolvedValue(undefined);
    activeRequestsForSummaryMock.mockResolvedValue([]);
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
      activeRequestsForSummaryMock.mockResolvedValue([domainRequest, { ...domainRequest, id: 2 }]);

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('count', 2);
    });

    it('returns 200 with status skipped when no active requests', async () => {
      activeRequestsForSummaryMock.mockResolvedValue([]);

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('skipped');
      expect(body).toHaveProperty('count', 0);
      expect(sendDailySummaryMock).not.toHaveBeenCalled();
    });

    it('delegates the active-requests query to the request lifecycle module', async () => {
      await GET(mockRequest);

      expect(activeRequestsForSummaryMock).toHaveBeenCalledTimes(1);
    });

    it('passes requests to sendDailySummary as notification DTOs', async () => {
      activeRequestsForSummaryMock.mockResolvedValue([domainRequest]);

      await GET(mockRequest);

      expect(sendDailySummaryMock).toHaveBeenCalledWith([
        {
          id: 1,
          title: 'Inception',
          requested_by: 'Alice',
          status: 'pending',
          requested_at: new Date('2026-06-06T10:00:00.000Z'),
          release_date: '2010-07-16',
          media_type: 'movie',
          season_number: null,
        },
      ]);
    });
  });

  describe('error handling', () => {
    it('returns 500 when activeRequestsForSummary throws', async () => {
      activeRequestsForSummaryMock.mockRejectedValue(new Error('DB error'));

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
      activeRequestsForSummaryMock.mockResolvedValue([domainRequest]);
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
