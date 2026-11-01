import { TmdbClient } from '@/lib/tmdb';
import { db as drizzleDb, type Db } from '../../../drizzle/db';

import {
  createRequestIntake,
  createRequestJobSyncWrites,
  createRequestLifecycle,
  EnqueueJob,
  RequestIntake,
  RequestIntakeDeps,
  RequestJobSync,
  RequestJobSyncDeps,
  RequestLifecycle,
  RequestLifecycleDeps,
} from './lifecycle';
import {
  createRequestJobSyncReads,
  createRequestReads,
  RequestJobSyncReads,
  RequestJobSyncReadsDeps,
  RequestReads,
  RequestReadsDeps,
} from './queries';

export type { RequestLifecycle } from './lifecycle';
export type { RequestIntake } from './lifecycle';
export type {
  RequestJobSync,
  SuggestionEntry,
  SyncDecision,
  SyncApplyResult,
  AutoLinkEntry,
} from './lifecycle';
export type { RequestReads } from './queries';
export type { RequestLifecycleDeps, RequestIntakeDeps, RequestJobSyncDeps };

export type { EnqueueJob } from './lifecycle';

/**
 * Shared factory-deps for the composed service. The two internal modules
 * (lifecycle = writes, queries = reads) accept narrower deps of their own;
 * this is the union shape callers pass to `createRequestService`.
 */
export interface RequestServiceDeps {
  /** Drizzle client; defaults to the shared singleton. Serves reads and writes. */
  db?: Db;
  enqueueJob: EnqueueJob;
  now?: () => Date;
  tmdb?: TmdbClient;
}

/**
 * Composed service: the historical union of every request-lifecycle verb.
 * Existing callers (`requestService` singleton, actions, cron routes,
 * import-flow, needs-match, etc.) depend on this name, so it stays exported
 * as the intersection of the four narrower module interfaces.
 *
 * Internal callers (job modules) should depend on `RequestJobSync` directly;
 * route/action callers should depend on the verb they need.
 */
export type RequestService = RequestLifecycle & RequestIntake & RequestJobSync & RequestReads;

/**
 * Named dependency ports for this module's seams.
 *
 * A port is the interface one seam (page, action module, cron route, job, or
 * import flow) actually calls. Depending on the port instead of a verb-by-verb
 * `Pick` keeps the dependency narrow at the import site and lets a test inject
 * a fake that implements only those verbs. Every port is a projection of one of
 * the internal module interfaces (`RequestLifecycle`, `RequestIntake`,
 * `RequestJobSync`, `RequestReads`); the composed `RequestService` union stays
 * the singleton's type and should not be a caller dependency.
 */

/** Paged queue read seam (`/requests`). */
export type RequestListPort = Pick<RequestReads, 'listRequests'>;

/** Single-row read seam (`/requests/[id]`). */
export type RequestDetailPort = Pick<RequestReads, 'requestById'>;

/** Operator action seam: the four named lifecycle verbs, nothing else. */
export type RequestActionsPort = RequestLifecycle;

/** Intake seam for the import flow: create one Request or fan out a series. */
export type ImportIntakePort = RequestIntake;

/** Daily-summary cron seam. */
export type RequestSummaryPort = Pick<RequestJobSync, 'activeRequestsForSummary'>;

/** Retention-cleanup cron seam. */
export type RequestCleanupPort = Pick<RequestJobSync, 'retireResolved'>;

/** Needs-match badge counts seam. */
export type RequestQueueStatsPort = Pick<RequestJobSync, 'queueStats'>;

/** Needs-match page read seam. */
export type RequestNeedsMatchPort = Pick<
  RequestJobSync,
  'pendingRequestsForNeedsMatch' | 'downloadingRequestsWithTorrentProblems'
>;

/** Transmission sync pass, observation step. */
export type RequestSyncObservationPort = Pick<
  RequestJobSync,
  'downloadingRequestsWithHashes' | 'applySyncDecisions'
>;

/** Transmission sync pass, suggestion/persist step. */
export type RequestSyncSuggestionPort = Pick<
  RequestJobSync,
  'pendingRequestsForNeedsMatch' | 'recordSuggestionBatch' | 'claimedTorrentHashes' | 'autoLinkBatch'
>;

/**
 * The sync pass's job port: the observation half plus the suggestion half. The
 * pass depends on this single interface; its two internal steps accept the
 * narrower halves above.
 */
export type RequestSyncPort = RequestSyncObservationPort & RequestSyncSuggestionPort;

/**
 * Build the composed service. Writes (lifecycle/intake/job-sync write verbs)
 * live in `lifecycle.ts`; reads (projection/validators/reads/job-sync read
 * verbs) live in `queries.ts`. This factory is the only place the two halves
 * are joined, so the singleton returned by `index.ts` still exposes every verb.
 */
export function createRequestService({
  db = drizzleDb,
  enqueueJob,
  now = () => new Date(),
  tmdb,
}: RequestServiceDeps): RequestService {
  const lifecycleDeps: RequestLifecycleDeps = { db, now };
  const intakeDeps: RequestIntakeDeps = { db, enqueueJob, tmdb };
  const jobSyncWriteDeps: RequestJobSyncDeps = { db, now };
  const readsDeps: RequestReadsDeps = { db };
  const jobSyncReadsDeps: RequestJobSyncReadsDeps = { db, now };

  const lifecycle: RequestLifecycle = createRequestLifecycle(lifecycleDeps);
  const intake: RequestIntake = createRequestIntake(intakeDeps);
  const jobSyncReads: RequestJobSyncReads = createRequestJobSyncReads(jobSyncReadsDeps);
  /**
   * The writes spread carries `retireResolved` too: retention cleanup is a
   * delete, so it is not part of the read surface `queries.ts` exposes.
   */
  const jobSync: RequestJobSync = {
    ...createRequestJobSyncWrites(jobSyncWriteDeps),
    ...jobSyncReads,
  };
  const reads: RequestReads = createRequestReads(readsDeps);

  return {
    ...lifecycle,
    ...intake,
    ...jobSync,
    ...reads,
  };
}
