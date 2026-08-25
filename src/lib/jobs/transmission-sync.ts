import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requestService } from '@/lib/request-lifecycle';
import { registerJobType, JobHandler } from '@/lib/job-queue';
import { TransmissionAdapter, HttpTransmissionAdapter } from '@/lib/transmission/adapter';
import { observeRequestCompletions } from './observe-request-completions';
import { computeRequestSuggestions } from './compute-request-suggestions';
const JOB_TYPE = 'transmission_sync';

export async function enqueueTransmissionSync(): Promise<boolean> {
  const outstanding = await prisma.job.findFirst({
    where: { type: JOB_TYPE, status: { in: ['pending', 'processing'] } },
    select: { id: true },
  });

  if (outstanding) {
    logger.debug({ jobId: outstanding.id }, 'transmission_sync already outstanding, skipping enqueue');
    return false;
  }

  await prisma.job.create({ data: { type: JOB_TYPE, payload: {} } });
  logger.info('transmission_sync job enqueued');
  return true;
}

interface SyncHandlerOptions {
  adapter: TransmissionAdapter;
}

interface TransmissionSyncOptions {
  ignoreSuggestionAgeGate?: boolean;
}

export async function runTransmissionSync(
  adapter: TransmissionAdapter,
  { ignoreSuggestionAgeGate = false }: TransmissionSyncOptions = {},
): Promise<void> {
      const completionResult = await observeRequestCompletions({ adapter, prisma, requestService });
      if (completionResult.scanned > 0) {
        logger.info(completionResult, 'transmission_sync completed');
      } else {
        logger.debug('transmission_sync: no downloading requests with torrent_hash');
      }

      const now = new Date();
      const suggestionResult = await computeRequestSuggestions({
        adapter,
        prisma,
        now: () => now,
      }, { ignoreSuggestionAgeGate });
      for (const error of suggestionResult.persistenceErrors) {
        logger.error({ err: error.err, requestId: error.requestId }, 'transmission_sync: failed to persist suggestion');
      }
      if (suggestionResult.scanned === 0) {
        logger.debug('transmission_sync: no pending requests need suggestions');
        return;
      }
      logger.info(
        {
          scanned: suggestionResult.scanned,
          suggestions: suggestionResult.suggestions,
          medianScore: suggestionResult.medianScore,
          parserFailures: suggestionResult.parserFailures,
        },
        'transmission_sync suggestions computed'
      );
}

export function createTransmissionSyncHandler({ adapter }: SyncHandlerOptions): JobHandler<unknown> {
  return {
    handle: () => runTransmissionSync(adapter),
  };
}

registerJobType('transmission_sync', createTransmissionSyncHandler({
  adapter: new HttpTransmissionAdapter(),
}));
