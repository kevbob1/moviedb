import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('withLogging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs request_start and request_complete for successful requests', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200 } as Response);
    const wrapped = withLogging(handler);
    const req = { url: 'http://localhost/api/test', method: 'GET' } as unknown as Request;

    const response = await wrapped(req);
    expect(response.status).toBe(200);
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenNthCalledWith(1, expect.objectContaining({ method: 'GET', path: '/api/test', requestId: expect.any(String) }), 'request_start');
    expect(logger.info).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 200, durationMs: expect.any(Number), requestId: expect.any(String) }), 'request_complete');
  });

  it('logs request_error and re-throws on failure', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const wrapped = withLogging(handler);
    const req = { url: 'http://localhost/api/test', method: 'GET' } as unknown as Request;

    await expect(wrapped(req)).rejects.toThrow('boom');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ error: 'boom', durationMs: expect.any(Number), requestId: expect.any(String) }), 'request_error');
  });

  it('skips logging for health probe paths', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200 } as Response);
    const wrapped = withLogging(handler);
    const req = { url: 'http://localhost/api/health/live', method: 'GET' } as unknown as Request;

    await wrapped(req);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
