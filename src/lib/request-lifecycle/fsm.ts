/**
 * Compatibility shim: the FSM now lives in `./lifecycle` (write side). Kept so
 * existing importers of `./fsm` keep working.
 */
export {
  canTransition,
  getAllowedTransitions,
  InvalidTransitionError,
  REQUEST_TRANSITIONS,
  resolveSideEffects,
} from './lifecycle';
export type { RequestStatus, TransitionSideEffects } from './lifecycle';
