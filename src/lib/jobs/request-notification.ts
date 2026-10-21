import { registerJobType, JobHandler } from '../job-queue';
import { sendRequest, NotificationRequest } from '@/lib/notifications';

type RequestNotificationPayload = NotificationRequest;

export const requestNotificationHandler: JobHandler<RequestNotificationPayload> = {
  handle: async (payload) => {
    await sendRequest(payload);
  },
};

registerJobType('request_notification', requestNotificationHandler);

export type { RequestNotificationPayload };
