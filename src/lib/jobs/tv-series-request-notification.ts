import { registerJobType } from '../job-queue';
import { sendTvSeriesNotification } from '../notifications';

interface TvSeriesRequestNotificationPayload {
  title: string;
  requestedBy: string;
  seasons: number[];
  totalSeasons: number;
  posterPath: string | null;
  releaseDate: string | null;
}

registerJobType<TvSeriesRequestNotificationPayload>('tv_series_request_notification', {
  handle: sendTvSeriesNotification,
});

export type { TvSeriesRequestNotificationPayload };
