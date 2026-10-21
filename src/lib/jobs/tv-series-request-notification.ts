import { registerJobType, JobHandler } from '../job-queue';
import { sendTvSeries } from '@/lib/notifications';

interface TvSeriesRequestNotificationPayload {
  title: string;
  requestedBy: string;
  seasons: number[];
  totalSeasons: number;
  posterPath: string | null;
  releaseDate: string | null;
}

export const tvSeriesRequestNotificationHandler: JobHandler<TvSeriesRequestNotificationPayload> = {
  handle: sendTvSeries,
};

registerJobType('tv_series_request_notification', tvSeriesRequestNotificationHandler);

export type { TvSeriesRequestNotificationPayload };
