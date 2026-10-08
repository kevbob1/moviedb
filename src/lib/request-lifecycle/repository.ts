import { PrismaClient } from '@/generated/prisma/client';
import { TmdbClient } from '@/lib/tmdb';

import { createRequestIntake, EnqueueJob, RequestIntake, RequestIntakeDeps } from './intake';
import { createRequestJobSync, RequestJobSync, RequestJobSyncDeps } from './jobsync';
import { createRequestLifecycle, RequestLifecycle, RequestLifecycleDeps } from './lifecycle';
import { createRequestReads, RequestReads, RequestReadsDeps } from './reads';

export type { RequestLifecycle } from './lifecycle';
export type { RequestIntake } from './intake';
export type { RequestJobSync, SuggestionEntry, SyncDecision, AutoLinkEntry } from './jobsync';
export type { RequestReads } from './reads';
export type { RequestLifecycleDeps, RequestIntakeDeps, RequestJobSyncDeps, RequestReadsDeps };

export type { EnqueueJob } from './intake';

/**
 * Shared factory-deps for the composed service. The three internal modules
 * (lifecycle / intake / jobsync) accept narrower deps of their own; this is
 * the union shape callers pass to `createRequestService`.
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
 * Build the composed service. Each module is responsible for its own DB
 * writes, FSM rules, and read predicates; this factory wires them together so
 * the singleton returned by `index.ts` exposes every verb across the four
 * module interfaces.
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
  const jobSync: RequestJobSync = createRequestJobSync(jobSyncDeps);
  const reads: RequestReads = createRequestReads(readsDeps);

  return {
    ...lifecycle,
    ...intake,
    ...jobSync,
    ...reads,
  };
}