import { jobs } from '../../../drizzle/schema';

import { createRequestService, EnqueueJob, RequestService } from './repository';

export { createRequestService } from './repository';
export type {
  EnqueueJob,
  RequestService,
  RequestServiceDeps,
  RequestJobSync,
  RequestReads,
  SuggestionEntry,
  SyncDecision,
  AutoLinkEntry,
} from './repository';

/**
 * The caller-facing value object and its status union. The FSM, projection, and
 * validators are internal seams: callers that need those import from the file
 * that owns them (`./fsm`, `./projection`, `./validators`) rather than through
 * this barrier.
 */
export type { Request } from './projection';
export type { RequestStatus } from './fsm';
export { toRequestModel } from './projection';

const defaultEnqueueJob: EnqueueJob = async (tx, type, payload) => {
  // `updated_at` has no database default (Prisma's `@updatedAt` wrote it), so
  // the insert supplies it explicitly.
  await tx.insert(jobs).values({ type, payload, status: 'pending', updatedAt: new Date() });
};

export const requestService: RequestService = createRequestService({
  enqueueJob: defaultEnqueueJob,
});
