jest.mock('@/lib/notifications', () => ({
  sendRequest: jest.fn(),
}));

import { sendRequest } from '@/lib/notifications';
import { requestNotificationHandler } from '../request-notification';

describe('requestNotificationHandler', () => {
  it('delegates the payload to the notifications module', async () => {
    const payload = {
      id: 1,
      title: 'Movie',
      requested_by: 'kev',
      status: 'pending',
      requested_at: new Date('2026-01-01T00:00:00Z'),
    };

    await requestNotificationHandler.handle(payload);

    expect(sendRequest).toHaveBeenCalledWith(payload);
  });
});
