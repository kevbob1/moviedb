import { prisma } from '@/lib/prisma';
import { createRequestService, EnqueueJob, RequestService } from './repository';

export { createRequestService } from './repository';
export type {
  EnqueueJob,
  RequestService,
  RequestServiceDeps,
  RequestJobSync,
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
  await tx.job.create({
    data: { type, payload, status: 'pending' },
  });
};

export const requestService: RequestService = createRequestService({
  prisma,
  enqueueJob: defaultEnqueueJob,
});
