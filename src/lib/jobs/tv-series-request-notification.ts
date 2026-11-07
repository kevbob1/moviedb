import { sendTvSeries } from '@/lib/notifications';

import type { JobHandler, TvSeriesNotificationPayload } from './contracts';

export const tvSeriesRequestNotificationHandler: JobHandler<TvSeriesNotificationPayload> = {
  handle: sendTvSeries,
};
