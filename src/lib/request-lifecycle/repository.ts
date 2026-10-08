import { PrismaClient } from '@/generated/prisma/client';
import { TmdbClient } from '@/lib/tmdb';

import { createRequestIntake, EnqueueJob, RequestIntake, RequestIntakeDeps } from './intake';
import { createRequestJobSync, RequestJobSync, RequestJobSyncDeps } from './jobsync';
import { createRequestLifecycle, RequestLifecycle, RequestLifecycleDeps } from './lifecycle';

export type { RequestLifecycle } from './lifecycle';
export type { RequestIntake } from './intake';
export type { RequestJobSync, SuggestionEntry, SyncDecision, AutoLinkEntry } from './jobsync';
export type { RequestLifecycleDeps, RequestIntakeDeps, RequestJobSyncDeps };

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
 * as the intersection of the three narrower module interfaces.
 *
 * Internal callers (job modules) should depend on `RequestJobSync` directly;
 * route/action callers should depend on the verb they need.
 */
export type RequestService = RequestLifecycle & RequestIntake & RequestJobSync;

/**
 * Build the composed service. Each module is responsible for its own DB
 * writes and FSM rules; this factory wires them together so the singleton
 * returned by `index.ts` exposes all 15 verbs.
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

  const lifecycle: RequestLifecycle = createRequestLifecycle(lifecycleDeps);
  const intake: RequestIntake = createRequestIntake(intakeDeps);
  const jobSync: RequestJobSync = createRequestJobSync(jobSyncDeps);

  return {
    ...lifecycle,
    ...intake,
    ...jobSync,
  };
}