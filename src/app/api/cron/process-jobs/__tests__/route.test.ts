import { logger } from '@/lib/logger';

const processPendingJobsMock = jest.fn();
const headersMock = jest.fn();

jest.mock('@/lib/job-queue', () => ({
  processPendingJobs: (...args: unknown[]) => processPendingJobsMock(...args),
}));

jest.mock('@/lib/jobs', () => ({}));

jest.mock('next/headers', () => ({
  headers: () => headersMock(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
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

describe('process-jobs cron API', () => {
  const mockRequest = { url: 'http://localhost/api/cron/process-jobs', method: 'GET' } as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CRON_SECRET;
    headersMock.mockResolvedValue(new Headers());
    processPendingJobsMock.mockResolvedValue({ processed: 0, failed: 0 });
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
    it('calls processPendingJobs and returns results', async () => {
      processPendingJobsMock.mockResolvedValue({ processed: 3, failed: 1 });

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('processed', 3);
      expect(body).toHaveProperty('failed', 1);
    });

    it('returns 200 with zero results when no jobs to process', async () => {
      processPendingJobsMock.mockResolvedValue({ processed: 0, failed: 0 });

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('processed', 0);
    });
  });

  describe('error handling', () => {
    it('returns 500 when processPendingJobs throws', async () => {
      processPendingJobsMock.mockRejectedValue(new Error('DB error'));

      const response = await GET(mockRequest);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.status).toBe('error');
      expect(body).toHaveProperty('message', 'Job processing failed');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'DB error' }),
        'Process jobs cron failed'
      );
    });
  });
});

export {};
