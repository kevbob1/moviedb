import { sendRequest } from '@/lib/notifications';

import type { JobHandler, RequestNotificationPayload } from './contracts';

export const requestNotificationHandler: JobHandler<RequestNotificationPayload> = {
  handle: async (payload) => {
    await sendRequest(payload);
  },
};
