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
 * Server barrier for the request-lifecycle module.
 *
 * Client components import UI vocabulary from `./presentation`, server code
 * uses this barrier, and `./lifecycle` owns the write path.
 */
export {
  STATUS_CONFIG,
  actionToButtonVariant,
  canCancel,
  getAvailableActions,
  statusToPill,
  toRequestModel,
  validateCreateRequestInput,
  validateRequestedBy,
} from './presentation';
export type {
  ActionKind,
  ButtonVariant,
  CreateRequestInput,
  PillVariant,
  Request,
  RequestAction,
  RequestStatus,
  StatusConfig,
  ValidationResult,
} from './presentation';

/**
 * The jobs module's transaction verb, reached through its barrier. The call is
 * deferred so binding the dependency does not depend on which of the two module
 * bodies finishes evaluating first.
 */
export const requestService: RequestService = createRequestService({
  enqueueJob: (tx, type, payload) => enqueueInTx(tx, type, payload),
});
