import type { NotificationRequest } from '@/lib/notifications';

/** Every job type the queue can carry. `JobPayloads` is exhaustive over it. */
export type JobType =
  | 'transmission_sync'
  | 'request_notification'
  | 'tv_series_request_notification';

/** The status column's literals, as the database stores them. */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type SyncTrigger = 'manual' | 'scheduled';

export interface SyncPayload {
  trigger: SyncTrigger;
}

/** The stored payload is untyped JSON; both enqueue and the handler narrow it here. */
export function isTransmissionSyncPayload(payload: unknown): payload is SyncPayload {
  return typeof payload === 'object'
    && payload !== null
    && 'trigger' in payload
    && (payload.trigger === 'scheduled' || payload.trigger === 'manual');
}

/**
 * The notification job stores the created row verbatim (`{ ...row }` over
 * `requestColumns`), so its payload keys stay snake_case: they are stored data,
 * not an internal model.
 */
export type RequestNotificationPayload = NotificationRequest;

export interface TvSeriesNotificationPayload {
  title: string;
  requestedBy: string;
  seasons: number[];
  totalSeasons: number;
  posterPath: string | null;
  releaseDate: string | null;
}

export interface JobPayloads {
  transmission_sync: SyncPayload;
  request_notification: RequestNotificationPayload;
  tv_series_request_notification: TvSeriesNotificationPayload;
}

/**
 * A run as callers see it. Dates cross this seam as ISO strings, the same
 * convention request-lifecycle's `toRequestModel` uses.
 */
export interface JobRun {
  status: JobStatus;
  queuedAt: string;
  finishedAt: string | null;
  error: string | null;
  trigger?: SyncTrigger;
  terminal: boolean;
}

export interface JobHandler<T> {
  handle: (payload: T) => Promise<void>;
}
