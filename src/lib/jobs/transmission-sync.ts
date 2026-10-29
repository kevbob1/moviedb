import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../../../drizzle/db';
import { jobs } from '../../../drizzle/schema';
import { logger } from '@/lib/logger';
import { requestService } from '@/lib/request-lifecycle';
import type {
  AutoLinkEntry,
  RequestJobSync,
  SuggestionEntry,
  SyncDecision,
} from '@/lib/request-lifecycle';
import { registerJobType, JobHandler } from '@/lib/job-queue';
import { TransmissionAdapter, TransmissionNotConfiguredError } from '@/lib/transmission/adapter';
import {
  createTransmissionCatalog,
  TransmissionCatalog,
} from '@/lib/transmission/catalog';
import { transmissionAdapter, transmissionCatalog } from '@/lib/transmission';
import { allocateMatches } from '@/lib/matcher';

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

interface OutstandingJob {
  id: number;
  status: string;
  payload: unknown;
  created_at: Date;
}

/** Attempts allowed when a unique violation costs us the insert race. */
const MAX_ENQUEUE_ATTEMPTS = 2;

async function findOutstandingSync(): Promise<OutstandingJob | null> {
  const [row] = await db
    .select({
      id: jobs.id,
      status: jobs.status,
      payload: jobs.payload,
      created_at: jobs.createdAt,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.type, JOB_TYPE),
        inArray(jobs.status, ['pending', 'processing']),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Every "not queued" exit funnels through here, including the race loser. */
async function settleOutstanding(
  outstanding: OutstandingJob,
  payload: TransmissionSyncPayload,
): Promise<EnqueueTransmissionSyncResult> {
  if (payload.trigger === 'manual' && outstanding.status === 'pending'
    && !(isTransmissionSyncPayload(outstanding.payload) && outstanding.payload.trigger === 'manual')) {
    await db
      .update(jobs)
      .set({ payload: { trigger: 'manual' }, updatedAt: new Date() })
      .where(eq(jobs.id, outstanding.id));
  }
  logger.debug({ jobId: outstanding.id }, 'transmission_sync already outstanding, skipping enqueue');
  return {
    queued: false,
    status: outstanding.status as TransmissionSyncJobStatus,
    createdAt: outstanding.created_at.toISOString(),
  };
}

/**
 * The singleton guard is a partial unique index, so the conflict surfaces as
 * Postgres' own unique-violation SQLSTATE (23505) rather than a Prisma error.
 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === '23505';
}

export async function enqueueTransmissionSync(
  payload: TransmissionSyncPayload = { trigger: 'scheduled' },
): Promise<EnqueueTransmissionSyncResult> {
  const outstanding = await findOutstandingSync();
  if (outstanding) {
    return settleOutstanding(outstanding, payload);
  }

  // The fast path above is not a lock: a concurrent caller can insert between
  // the find and the create. The partial unique index
  // jobs_singleton_live_type_key (see prisma/migrations/20261020050000) turns
  // that race into a duplicate-key error instead of a duplicate row, so the
  // loser reports queued: false rather than inserting twice.
  for (let attempt = 1; attempt <= MAX_ENQUEUE_ATTEMPTS; attempt++) {
    try {
      const [job] = await db
        .insert(jobs)
        .values({
          type: JOB_TYPE,
          payload: { trigger: payload.trigger },
          updatedAt: new Date(),
        })
        .returning({ created_at: jobs.createdAt });
      if (!job) {
        throw new Error('transmission_sync enqueue returned no row');
      }
      logger.info('transmission_sync job enqueued');
      return { queued: true, status: 'pending', createdAt: job.created_at.toISOString() };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const winner = await findOutstandingSync();
      if (winner) {
        return settleOutstanding(winner, payload);
      }
      // The winner finished before we could read it; the slot is free again.
      if (attempt === MAX_ENQUEUE_ATTEMPTS) throw error;
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new Error('transmission_sync enqueue exhausted its attempts');
}

/**
 * The pass's logging seam. Named so it can be narrowed without the `typeof logger`
 * reference resolving to a function parameter of the same name.
 */
type SyncLogger = Pick<typeof logger, 'debug' | 'info' | 'error'>;

const SEEDING_STATUS = 6;

/**
 * The sync pass's output: what the pass observed, decided, and persisted,
 * in one shape.
 */
export interface SyncPassReport {
  downloading: number;   // linked downloading requests observed
  fulfilled: number;     // actually applied by the batch (a stale verdict does not count)
  problems: number;      // actually stamped with a torrent problem
  skipped: number;       // verdicts the batch left alone: already moved, or row gone
  pending: number;       // pending requests scored
  suggestions: number;   // requests with a persisted suggestion
  autoLinked: number;    // requests linked without operator confirmation (ADR-0009)
  medianScore: number;   // median of scored matches (suggestions + auto-links), 0 when none
  parserFailures: number;
}

export interface TransmissionSyncDependencies {
  requestService: Pick<
    RequestJobSync,
    | 'downloadingRequestsWithHashes'
    | 'applySyncDecisions'
    | 'pendingRequestsForNeedsMatch'
    | 'recordSuggestionBatch'
    | 'claimedTorrentHashes'
    | 'autoLinkBatch'
  >;
  logger: SyncLogger;
  adapter: TransmissionAdapter;
  catalog?: TransmissionCatalog;
}

interface TransmissionSyncOptions {
  ignoreSuggestionAgeGate?: boolean;
}

export function createTransmissionSync({
  requestService,
  logger,
  adapter,
  catalog,
}: TransmissionSyncDependencies) {
  const transmissionCatalog = catalog ?? createTransmissionCatalog(adapter);

  async function run(
    { ignoreSuggestionAgeGate = false }: TransmissionSyncOptions = {},
  ): Promise<SyncPassReport> {
    transmissionCatalog.refresh();

    const observation = await observeLinkedTorrents({ requestService, adapter });
    const suggestion = await computeSuggestions(
      { requestService, catalog: transmissionCatalog, logger },
      { ignoreSuggestionAgeGate },
    );

    const report: SyncPassReport = {
      downloading: observation.downloading,
      fulfilled: observation.fulfilled,
      problems: observation.problems,
      skipped: observation.skipped,
      pending: suggestion.pending,
      suggestions: suggestion.suggestions,
      autoLinked: suggestion.autoLinked,
      medianScore: suggestion.medianScore,
      parserFailures: suggestion.parserFailures,
    };

    if (report.downloading > 0 || report.pending > 0) {
      logger.info(report, 'transmission_sync completed');
    } else {
      logger.debug(report, 'transmission_sync completed');
    }
    return report;
  }

  return { run };
}

export function createTransmissionSyncHandler(
  dependencies: TransmissionSyncDependencies,
): JobHandler<TransmissionSyncPayload | unknown> {
  const transmissionSync = createTransmissionSync(dependencies);
  return {
    handle: async (payload) => {
      const trigger = isTransmissionSyncPayload(payload) ? payload.trigger : 'scheduled';
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

/**
 * Observation step (ADR-0005): fetch the torrents linked to downloading
 * requests and decide `fulfilled` / `problem` per request.
 */
async function observeLinkedTorrents({
  requestService,
  adapter,
}: {
  requestService: Pick<RequestJobSync, 'downloadingRequestsWithHashes' | 'applySyncDecisions'>;
  adapter: TransmissionAdapter;
}): Promise<{ downloading: number; fulfilled: number; problems: number; skipped: number }> {
  const downloading = await requestService.downloadingRequestsWithHashes();

  if (downloading.length === 0) {
    return { downloading: 0, fulfilled: 0, problems: 0, skipped: 0 };
  }

  let torrents: Awaited<ReturnType<TransmissionAdapter['getTorrents']>>;
  try {
    torrents = await adapter.getTorrents(
      downloading.map((request) => request.torrent_hash),
    );
  } catch (err) {
    if (err instanceof TransmissionNotConfiguredError) {
      return { downloading: 0, fulfilled: 0, problems: 0, skipped: 0 };
    }
    throw err;
  }
  const torrentByHash = new Map(torrents.map((torrent) => [torrent.hash, torrent]));
  const decisions: SyncDecision[] = [];

  for (const request of downloading) {
    const torrent = torrentByHash.get(request.torrent_hash);
    if (!torrent) {
      decisions.push({
        requestId: request.id,
        outcome: 'problem',
        problem: 'Torrent not found in Transmission',
      });
      continue;
    }
    if (torrent.error) {
      decisions.push({
        requestId: request.id,
        outcome: 'problem',
        problem: `Transmission error: ${torrent.error}`,
      });
      continue;
    }
    if (torrent.isFinished === true || torrent.status === SEEDING_STATUS) {
      decisions.push({ requestId: request.id, outcome: 'fulfilled' });
    }
  }

  // Nothing decided means nothing to apply: the module is not called at all.
  const result = decisions.length > 0
    ? await requestService.applySyncDecisions(decisions)
    : { applied: [] as number[], skipped: 0 };

  return {
    downloading: downloading.length,
    fulfilled: result.applied.length,
    problems: decisions.length - result.applied.length - result.skipped,
    skipped: result.skipped,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Suggestion step (ADR-0008 + ADR-0009): hand the pending requests and the
 * torrent catalog to the matcher, which scores them and allocates claimed
 * torrents, then persist what it resolved — auto-links immediately, the rest as
 * suggestions for the operator.
 */
async function computeSuggestions(
  {
    requestService,
    catalog,
    logger,
  }: {
    requestService: Pick<
      RequestJobSync,
      'pendingRequestsForNeedsMatch' | 'recordSuggestionBatch' | 'claimedTorrentHashes' | 'autoLinkBatch'
    >;
    catalog: TransmissionCatalog;
    logger: Pick<SyncLogger, 'info'>;
  },
  { ignoreSuggestionAgeGate = false }: { ignoreSuggestionAgeGate?: boolean } = {},
): Promise<{
  pending: number;
  suggestions: number;
  autoLinked: number;
  medianScore: number;
  parserFailures: number;
}> {
  const pendingRequests = await requestService.pendingRequestsForNeedsMatch({
    applySuggestionAgeGate: !ignoreSuggestionAgeGate,
  });

  if (pendingRequests.length === 0) {
    return { pending: 0, suggestions: 0, autoLinked: 0, medianScore: 0, parserFailures: 0 };
  }

  const claimed = new Set(await requestService.claimedTorrentHashes());
  const allTorrents = await catalog.getAll();

  // The matcher owns scoring, thresholds, and claim allocation (ADR-0008 +
  // ADR-0009): one call resolves who gets what. This step's job is to carry
  // those verdicts to the lifecycle module's batch verbs.
  const { outcomes, parserFailures } = allocateMatches(
    pendingRequests.map((request) => ({
      id: request.id,
      title: request.title,
      media_type: request.media_type ?? '',
      release_date: request.release_date,
      season_number: request.season_number,
      requested_at: request.requested_at,
    })),
    allTorrents,
    { claimedHashes: claimed },
  );

  const scores: number[] = [];
  const autoLinks: Array<{ requestId: number; hash: string; score: number }> = [];
  const entries: SuggestionEntry[] = [];

  for (const outcome of outcomes) {
    const requestId = Number(outcome.requestId);
    if (outcome.outcome === 'auto-link') {
      scores.push(outcome.score);
      autoLinks.push({ requestId, hash: outcome.hash, score: outcome.score });
      continue;
    }
    if (outcome.outcome === 'suggestion') {
      scores.push(outcome.score);
      entries.push({ requestId, suggestion: { hash: outcome.hash, score: outcome.score } });
      continue;
    }
    entries.push({ requestId, suggestion: null });
  }

  let linked: number[] = [];
  if (autoLinks.length > 0) {
    linked = await requestService.autoLinkBatch(
      autoLinks.map<AutoLinkEntry>(({ requestId, hash }) => ({ requestId, torrentHash: hash })),
    );
    for (const autoLink of autoLinks) {
      if (!linked.includes(autoLink.requestId)) continue;
      logger.info(
        { requestId: autoLink.requestId, torrentHash: autoLink.hash, score: autoLink.score },
        'auto-linked pending request to torrent',
      );
    }
  }

  if (entries.length > 0) {
    await requestService.recordSuggestionBatch(entries);
  }

  return {
    pending: pendingRequests.length,
    suggestions: entries.filter((entry) => entry.suggestion !== null).length,
    autoLinked: linked.length,
    medianScore: median(scores),
    parserFailures,
  };
}

export const transmissionSyncHandler: JobHandler<TransmissionSyncPayload | unknown> =
  createTransmissionSyncHandler({
    requestService,
    logger,
    adapter: transmissionAdapter,
    catalog: transmissionCatalog,
  });

registerJobType(JOB_TYPE, transmissionSyncHandler);
