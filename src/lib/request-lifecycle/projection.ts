/**
 * Compatibility shim: projection now lives in `./queries` (read side). Kept so
 * existing importers of `./projection` keep working.
 */
export {
  actionToButtonVariant,
  canCancel,
  getAvailableActions,
  STATUS_CONFIG,
  statusToPill,
  toRequestModel,
} from './queries';
export type {
  ActionKind,
  ButtonVariant,
  PillVariant,
  Request,
  RequestAction,
  StatusConfig,
} from './queries';
