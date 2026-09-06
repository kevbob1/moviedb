import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requestService } from '@/lib/request-lifecycle';
import { registerJobType, JobHandler } from '@/lib/job-queue';
import { TransmissionAdapter, HttpTransmissionAdapter } from '@/lib/transmission/adapter';
import { createTransmissionCatalog, TransmissionCatalog } from '@/lib/transmission/catalog';
import { observeRequestCompletions } from './observe-request-completions';
import { computeRequestSuggestions } from './compute-request-suggestions';
const JOB_TYPE = 'transmission_sync';

export type TransmissionSyncTrigger = 'scheduled' | 'manual';

export interface TransmissionSyncPayload {
  trigger: TransmissionSyncTrigger;
}

export type TransmissionSyncJobStatus = 'pending' | 'processing';

export interface EnqueueTransmissionSyncResult {
  queued: boolean;
  status: TransmissionSyncJobStatus;
  createdAt: string;
}

export async function enqueueTransmissionSync(
  payload: TransmissionSyncPayload = { trigger: 'scheduled' },
): Promise<EnqueueTransmissionSyncResult> {
  const outstanding = await prisma.job.findFirst({
    where: { type: JOB_TYPE, status: { in: ['pending', 'processing'] } },
    select: { id: true, status: true, payload: true, created_at: true },
  });

  if (outstanding) {
    if (payload.trigger === 'manual' && outstanding.status === 'pending'
      && !(isTransmissionSyncPayload(outstanding.payload) && outstanding.payload.trigger === 'manual')) {
      await prisma.job.update({
        where: { id: outstanding.id },
        data: { payload: { trigger: 'manual' } },
      });
    }
    logger.debug({ jobId: outstanding.id }, 'transmission_sync already outstanding, skipping enqueue');
    return {
      queued: false,
      status: outstanding.status as TransmissionSyncJobStatus,
      createdAt: outstanding.created_at.toISOString(),
    };
  }

  const job = await prisma.job.create({
    data: { type: JOB_TYPE, payload: { trigger: payload.trigger } },
    select: { created_at: true },
  });
  logger.info('transmission_sync job enqueued');
  return { queued: true, status: 'pending', createdAt: job.created_at.toISOString() };
}

export interface TransmissionSyncDependencies {
  prisma: typeof prisma;
  requestService: typeof requestService;
  logger: Pick<typeof logger, 'debug' | 'info' | 'error'>;
  adapter: TransmissionAdapter;
  catalog?: TransmissionCatalog;
}

interface TransmissionSyncOptions {
  ignoreSuggestionAgeGate?: boolean;
}

export function createTransmissionSync({
  prisma,
  requestService,
  logger,
  adapter,
  catalog,
}: TransmissionSyncDependencies) {
  const transmissionCatalog = catalog ?? createTransmissionCatalog(adapter);

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
        catalog: transmissionCatalog,
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

export function createTransmissionSyncHandler(
  dependencies: TransmissionSyncDependencies | { adapter: TransmissionAdapter },
): JobHandler<TransmissionSyncPayload | unknown> {
  const resolvedDependencies: TransmissionSyncDependencies = 'prisma' in dependencies
    ? { ...dependencies, catalog: dependencies.catalog ?? createTransmissionCatalog(dependencies.adapter) }
    : {
        prisma,
        requestService,
        logger,
        adapter: dependencies.adapter,
        catalog: createTransmissionCatalog(dependencies.adapter),
      };
  const transmissionSync = createTransmissionSync(resolvedDependencies);
  return {
    handle: async (payload) => {
      const trigger = isTransmissionSyncPayload(payload) ? payload.trigger : 'scheduled';
      resolvedDependencies.catalog?.refresh();
      await transmissionSync.run({ ignoreSuggestionAgeGate: trigger === 'manual' });
    },
  };
}

function isTransmissionSyncPayload(payload: unknown): payload is TransmissionSyncPayload {
  return typeof payload === 'object'
    && payload !== null
    && 'trigger' in payload
    && (payload.trigger === 'scheduled' || payload.trigger === 'manual');
}

const productionAdapter = new HttpTransmissionAdapter();

registerJobType('transmission_sync', createTransmissionSyncHandler({
  prisma,
  requestService,
  logger,
  adapter: productionAdapter,
  catalog: createTransmissionCatalog(productionAdapter),
}));
