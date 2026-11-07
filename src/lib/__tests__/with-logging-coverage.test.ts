jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { logger } from '@/lib/logger';
import { withLogging } from '../with-logging';

describe('withLogging coverage edges', () => {
  it('logs a thrown non-Error value as text and rethrows it', async () => {
    const handler = withLogging(async () => {
      throw 'boom';
    });

    await expect(
      handler({ url: 'http://localhost/api/things', method: 'GET' } as unknown as Request),
    ).rejects.toBe('boom');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'boom', path: '/api/things' }),
      'request_error',
    );
  });
});
