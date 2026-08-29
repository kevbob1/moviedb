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

export interface TransmissionSyncDependencies {
  prisma: typeof prisma;
  requestService: typeof requestService;
  logger: Pick<typeof logger, 'debug' | 'info' | 'error'>;
  adapter: TransmissionAdapter;
}

interface TransmissionSyncOptions {
  ignoreSuggestionAgeGate?: boolean;
}

export function createTransmissionSync({
  prisma,
  requestService,
  logger,
  adapter,
}: TransmissionSyncDependencies) {
  async function run(
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

  return { run };
}

/**
 * Compatibility entry point for callers that used the pre-construction API.
 * New orchestration code should use createTransmissionSync instead.
 */
export function runTransmissionSync(
  adapter: TransmissionAdapter,
  options: TransmissionSyncOptions = {},
): Promise<void> {
  return createTransmissionSync({ prisma, requestService, logger, adapter }).run(options);
}

export function createTransmissionSyncHandler(
  dependencies: TransmissionSyncDependencies | { adapter: TransmissionAdapter },
): JobHandler<unknown> {
  const transmissionSync = createTransmissionSync(
    'prisma' in dependencies
      ? dependencies
      : { prisma, requestService, logger, adapter: dependencies.adapter },
  );
  return {
    handle: () => transmissionSync.run(),
  };
}

registerJobType('transmission_sync', createTransmissionSyncHandler({
  prisma,
  requestService,
  logger,
  adapter: new HttpTransmissionAdapter(),
}));
