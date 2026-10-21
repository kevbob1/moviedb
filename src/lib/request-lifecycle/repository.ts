import { PrismaClient } from '@/generated/prisma/client';
import { TmdbClient } from '@/lib/tmdb';

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
  prisma: PrismaClient;
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
 * Build the composed service. Writes (lifecycle/intake/job-sync write verbs)
 * live in `lifecycle.ts`; reads (projection/validators/reads/job-sync read
 * verbs) live in `queries.ts`. This factory is the only place the two halves
 * are joined, so the singleton returned by `index.ts` still exposes every verb.
 */
export function createRequestService({
  prisma,
  enqueueJob,
  now = () => new Date(),
  tmdb,
}: RequestServiceDeps): RequestService {
  const lifecycleDeps: RequestLifecycleDeps = { prisma, now };
  const intakeDeps: RequestIntakeDeps = { prisma, enqueueJob, tmdb };
  const jobSyncDeps: RequestJobSyncDeps = { prisma, now };
  const readsDeps: RequestReadsDeps = { prisma };

  const lifecycle: RequestLifecycle = createRequestLifecycle(lifecycleDeps);
  const intake: RequestIntake = createRequestIntake(intakeDeps);
  const jobSyncReads: RequestJobSyncReads = createRequestJobSyncReads(jobSyncDeps);
  const jobSync: RequestJobSync = {
    ...createRequestJobSyncWrites(jobSyncDeps),
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
