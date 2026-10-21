/**
 * Compatibility shim: validators now live in `./queries` (read side). Kept so
 * existing importers of `./validators` keep working.
 */
export { validateCreateRequestInput, validateRequestedBy } from './queries';
export type { CreateRequestInput, ValidationResult } from './queries';
