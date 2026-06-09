import { registerJobType } from '../job-queue';
import { sendRequestNotification, NotificationRequest } from '../notifications';

type RequestNotificationPayload = NotificationRequest;

registerJobType<RequestNotificationPayload>('request_notification', {
  handle: async (payload) => {
    await sendRequestNotification(payload);
  },
});

export type { RequestNotificationPayload };
