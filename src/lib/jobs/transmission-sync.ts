import { logger } from '@/lib/logger';
import { createTransmissionSync, type TransmissionSyncDependencies } from '@/lib/sync-pass';
import { transmissionAdapter } from '@/lib/transmission';

import { isTransmissionSyncPayload } from './contracts';
import type { JobHandler, SyncPayload } from './contracts';

/**
 * The jobs-side adapter for the sync pass. It owns only the queue-to-pass
 * mapping: the pass itself lives in `@/lib/sync-pass`.
 *
 * The pass is built inside `handle` rather than when the handler is created so
 * this module reads nothing from `@/lib/sync-pass` while modules are still
 * evaluating.
 */
export function createTransmissionSyncHandler(
  dependencies: TransmissionSyncDependencies,
): JobHandler<SyncPayload | unknown> {
  return {
    handle: async (payload) => {
      const trigger = isTransmissionSyncPayload(payload) ? payload.trigger : 'scheduled';
      await createTransmissionSync(dependencies).run({
        ignoreSuggestionAgeGate: trigger === 'manual',
      });
    },
  };
}

export const transmissionSyncHandler: JobHandler<SyncPayload | unknown> =
  createTransmissionSyncHandler({
    logger,
    adapter: transmissionAdapter,
  });
