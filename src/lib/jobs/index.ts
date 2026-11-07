import { registerJobType } from './queue';
import { requestNotificationHandler } from './request-notification';
import { transmissionSyncHandler } from './transmission-sync';
import { tvSeriesRequestNotificationHandler } from './tv-series-request-notification';

export { enqueue, enqueueInTx } from './enqueue';
export type { EnqueueResult } from './enqueue';
export { latestRun } from './latest';
export { processPendingJobs, registerJobType } from './queue';
export type { ProcessResult } from './queue';
export type {
  JobHandler,
  JobPayloads,
  JobRun,
  JobStatus,
  JobType,
  RequestNotificationPayload,
  SyncPayload,
  SyncTrigger,
  TvSeriesNotificationPayload,
} from './contracts';
export { isTerminalStatus, jobStatusLabel, syncRunLabel } from './status';

/**
 * The one registration site. The cron route calls this once at module load;
 * handler modules export handler objects and register nothing themselves.
 */
export function registerAllJobTypes(): void {
  registerJobType('transmission_sync', transmissionSyncHandler);
  registerJobType('request_notification', requestNotificationHandler);
  registerJobType('tv_series_request_notification', tvSeriesRequestNotificationHandler);
}
