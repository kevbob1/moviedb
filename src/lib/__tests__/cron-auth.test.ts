import { requireCronAuth } from '@/lib/cron-auth';

describe('requireCronAuth', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it('returns null when CRON_SECRET is unset (fail-open)', () => {
    expect(requireCronAuth(new Headers())).toBeNull();
  });

  it('returns 401 when CRON_SECRET is set and Authorization header is missing', async () => {
    process.env.CRON_SECRET = 'secret-token';

    const response = requireCronAuth(new Headers());
    if (!response) {
      throw new Error('expected a 401 response');
    }
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ status: 'error', message: 'Unauthorized' });
  });

  it('returns 401 when CRON_SECRET is set and Authorization header is wrong', async () => {
    process.env.CRON_SECRET = 'secret-token';

    const response = requireCronAuth(new Headers({ authorization: 'Bearer wrong' }));
    if (!response) {
      throw new Error('expected a 401 response');
    }
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ status: 'error', message: 'Unauthorized' });
  });

  it('returns null when Authorization header carries the matching Bearer token', () => {
    process.env.CRON_SECRET = 'secret-token';

    expect(requireCronAuth(new Headers({ authorization: 'Bearer secret-token' }))).toBeNull();
  });
});
