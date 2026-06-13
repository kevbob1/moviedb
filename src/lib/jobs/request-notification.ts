import { registerJobType } from '../job-queue';
import { sendRequest, NotificationRequest } from '@/lib/notifications';

type RequestNotificationPayload = NotificationRequest;

registerJobType<RequestNotificationPayload>('request_notification', {
  handle: async (payload) => {
    await sendRequest(payload);
  },
});

export type { RequestNotificationPayload };
