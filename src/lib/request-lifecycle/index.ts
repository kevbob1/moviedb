import { prisma } from '@/lib/prisma';
import { createRequestService, EnqueueJob, RequestService } from './repository';

export { createRequestService } from './repository';
export type { EnqueueJob, RequestService, RequestServiceDeps } from './repository';

export {
  REQUEST_TRANSITIONS,
  canTransition,
  getAllowedTransitions,
  InvalidTransitionError,
  resolveSideEffects,
} from './fsm';
export type { RequestStatus, TransitionSideEffects } from './fsm';

export {
  STATUS_CONFIG,
  statusToPill,
  actionToButtonVariant,
  getAvailableActions,
  canCancel,
  toRequestModel,
} from './projection';
export type {
  ActionKind,
  ButtonVariant,
  PillVariant,
  Request,
  RequestAction,
  StatusConfig,
} from './projection';

export {
  validateCreateRequestInput,
  validateRequestedBy,
} from './validators';
export type { CreateRequestInput, ValidationResult } from './validators';

const defaultEnqueueJob: EnqueueJob = async (tx, type, payload) => {
  await tx.job.create({
    data: { type, payload, status: 'pending' },
  });
};

export const requestService: RequestService = createRequestService({
  prisma,
  enqueueJob: defaultEnqueueJob,
});