import { logger } from '@/lib/logger';

const queueStatsMock = jest.fn();

jest.mock('@/lib/request-lifecycle', () => ({
  requestService: {
    queueStats: queueStatsMock,
  },
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

describe('needs-match API', () => {
  const mockRequest = { url: 'http://localhost/api/requests/needs-match', method: 'GET' } as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns both needsMatchCount and needsAttentionCount', async () => {
    queueStatsMock.mockResolvedValueOnce({ needsMatch: 3, needsAttention: 2 });

    const response = await GET(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ needsMatchCount: 3, needsAttentionCount: 2 });
    expect(queueStatsMock).toHaveBeenCalledTimes(1);
  });

  it('returns zero counts when none match', async () => {
    queueStatsMock.mockResolvedValueOnce({ needsMatch: 0, needsAttention: 0 });

    const response = await GET(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ needsMatchCount: 0, needsAttentionCount: 0 });
  });

  it('returns 500 on error', async () => {
    queueStatsMock.mockRejectedValue(new Error('DB error'));

    const response = await GET(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toHaveProperty('error');
    expect(logger.error).toHaveBeenCalled();
  });
});
