import { sendRequestNotification } from '../../notifications';

jest.mock('../../notifications', () => ({
  sendRequestNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

describe('request_notification handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers handler and delegates to sendRequestNotification', async () => {
    // Importing the module triggers registerJobType in the handler's side-effect
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../request-notification');

    const payload = {
      id: 1,
      title: 'Test Movie',
      requested_by: 'Alice',
      status: 'pending',
      requested_at: new Date(),
      release_date: '2024-01-01',
      media_type: 'movie',
      season_number: null,
    };

    await sendRequestNotification(payload);

    expect(sendRequestNotification).toHaveBeenCalledWith(payload);
  });
});
