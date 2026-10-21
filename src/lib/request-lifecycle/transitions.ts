/**
 * Compatibility shim: the transition write path now lives in `./lifecycle`.
 * Kept so existing importers of `./transitions` keep working.
 */
export { applyTransition } from './lifecycle';
export type { TransitionClient, TransitionExtras, TransitionOutcome } from './lifecycle';
