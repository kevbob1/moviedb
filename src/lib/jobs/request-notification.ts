import { registerJobType } from '../job-queue';
import { sendRequestNotification, NotificationRequest } from '../notifications';

interface RequestNotificationPayload extends NotificationRequest {}

registerJobType<RequestNotificationPayload>('request_notification', {
  handle: async (payload) => {
    await sendRequestNotification(payload);
  },
});

export type { RequestNotificationPayload };
