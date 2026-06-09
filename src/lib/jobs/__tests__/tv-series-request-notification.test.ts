const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: mockSendMail,
  }),
}));

jest.mock('../../logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

describe('tv_series_request_notification handler', () => {
  let sendTvSeriesNotification: (
    payload?: Record<string, unknown>
  ) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'password';
    process.env.NOTIFICATION_EMAIL = 'admin@test.com';
    process.env.APP_BASE_URL = 'https://example.com';
  });

  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.NOTIFICATION_EMAIL;
    delete process.env.APP_BASE_URL;
  });

  it('sends a single email listing all seasons', async () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../tv-series-request-notification');
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ sendTvSeriesNotification } = require('../../notifications'));

    await sendTvSeriesNotification({
      title: 'Best Show',
      requestedBy: 'Alice',
      seasons: [1, 2, 3],
      totalSeasons: 3,
      posterPath: null,
      releaseDate: '2023-01-01',
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('Best Show');
    expect(call.subject).toContain('Seasons 1-3');
    expect(call.html).toContain('Best Show');
  });

  it('skips sending when SMTP is not configured', async () => {
    delete process.env.SMTP_USER;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ sendTvSeriesNotification } = require('../../notifications'));

    await sendTvSeriesNotification({
      title: 'No SMTP Show',
      requestedBy: 'Bob',
      seasons: [1],
      totalSeasons: 1,
      posterPath: null,
      releaseDate: null,
    });

    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
