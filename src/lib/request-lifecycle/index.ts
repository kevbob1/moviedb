import { enqueueInTx } from '@/lib/jobs';

import { createRequestService, RequestService } from './repository';

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
  RequestListPort,
  RequestDetailPort,
  RequestActionsPort,
  ImportIntakePort,
  RequestSummaryPort,
  RequestCleanupPort,
  RequestQueueStatsPort,
  RequestNeedsMatchPort,
  RequestSyncObservationPort,
  RequestSyncSuggestionPort,
  RequestSyncPort,
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

/**
 * The jobs module's transaction verb, reached through its barrier. The call is
 * deferred so binding the dependency does not depend on which of the two module
 * bodies finishes evaluating first.
 */
export const requestService: RequestService = createRequestService({
  enqueueJob: (tx, type, payload) => enqueueInTx(tx, type, payload),
});
