const mockPino = jest.fn((options?: Record<string, unknown>) => ({
  level: options?.level,
  info: jest.fn(),
}));

jest.mock('pino', () => ({ __esModule: true, default: mockPino }));

import type { Logger } from 'pino';

describe('logger configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const mutableEnv = process.env as Record<string, string | undefined>;

  beforeEach(() => {
    mockPino.mockClear();
  });

  afterEach(() => {
    mutableEnv.NODE_ENV = originalNodeEnv;
    jest.resetModules();
  });

  async function importLogger(): Promise<{ logger: Logger }> {
    jest.resetModules();
    return (await import('../logger')) as { logger: Logger };
  }

  it('uses debug level and a pino-pretty transport in development', async () => {
    mutableEnv.NODE_ENV = 'development';

    await importLogger();

    expect(mockPino).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'debug',
        transport: expect.objectContaining({ target: 'pino-pretty' }),
      }),
    );
  });

  it('uses info level without a transport outside development', async () => {
    mutableEnv.NODE_ENV = 'production';

    await importLogger();

    const options = mockPino.mock.calls[0][0] ?? {};
    expect(options.level).toBe('info');
    expect(options).not.toHaveProperty('transport');
  });
});
