import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requestService } from '@/lib/request-lifecycle';
import type { RequestJobSync, SuggestionEntry, SyncDecision } from '@/lib/request-lifecycle';
import { registerJobType, JobHandler } from '@/lib/job-queue';
import { TransmissionAdapter, TransmissionNotConfiguredError } from '@/lib/transmission/adapter';
import {
  createTransmissionCatalog,
  TransmissionCatalog,
} from '@/lib/transmission/catalog';
import { transmissionAdapter, transmissionCatalog } from '@/lib/transmission';
import { matchSuggestions } from '@/lib/matcher';
import { parseTorrentTitle } from '@viren070/parse-torrent-title';

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

const SEEDING_STATUS = 6;

/**
 * The sync pass's output: what the pass observed, decided, and persisted,
 * in one shape.
 */
export interface SyncPassReport {
  downloading: number;   // linked downloading requests observed
  fulfilled: number;     // decided fulfilled
  problems: number;      // decided problem
  pending: number;       // pending requests scored
  suggestions: number;   // requests with a persisted suggestion
  medianScore: number;   // median of suggestion scores (0 when none)
  parserFailures: number;
}

export interface TransmissionSyncDependencies {
  requestService: Pick<
    RequestJobSync,
    'downloadingRequestsWithHashes' | 'applySyncDecisions' | 'pendingRequestsForNeedsMatch' | 'recordSuggestionBatch'
  >;
  logger: Pick<typeof logger, 'debug' | 'info' | 'error'>;
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
      { requestService, catalog: transmissionCatalog },
      { ignoreSuggestionAgeGate },
    );

    const report: SyncPassReport = {
      downloading: observation.downloading,
      fulfilled: observation.fulfilled,
      problems: observation.problems,
      pending: suggestion.pending,
      suggestions: suggestion.suggestions,
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
}): Promise<{ downloading: number; fulfilled: number; problems: number }> {
  const downloading = await requestService.downloadingRequestsWithHashes();

  if (downloading.length === 0) {
    return { downloading: 0, fulfilled: 0, problems: 0 };
  }

  let torrents: Awaited<ReturnType<TransmissionAdapter['getTorrents']>>;
  try {
    torrents = await adapter.getTorrents(
      downloading.map((request) => request.torrent_hash),
    );
  } catch (err) {
    if (err instanceof TransmissionNotConfiguredError) {
      return { downloading: 0, fulfilled: 0, problems: 0 };
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

  if (decisions.length > 0) {
    await requestService.applySyncDecisions(decisions);
  }

  const fulfilled = decisions.filter((decision) => decision.outcome === 'fulfilled').length;
  return {
    downloading: downloading.length,
    fulfilled,
    problems: decisions.length - fulfilled,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Suggestion step (ADR-0008): score pending requests for needs-match against
 * the full catalog and persist one suggestion entry per request.
 */
async function computeSuggestions({
  requestService,
  catalog,
}: {
  requestService: Pick<RequestJobSync, 'pendingRequestsForNeedsMatch' | 'recordSuggestionBatch'>;
  catalog: TransmissionCatalog;
  },
  { ignoreSuggestionAgeGate = false }: { ignoreSuggestionAgeGate?: boolean } = {},
): Promise<{ pending: number; suggestions: number; medianScore: number; parserFailures: number }> {
  const pendingRequests = await requestService.pendingRequestsForNeedsMatch({
    applySuggestionAgeGate: !ignoreSuggestionAgeGate,
  });

  if (pendingRequests.length === 0) {
    return { pending: 0, suggestions: 0, medianScore: 0, parserFailures: 0 };
  }

  const allTorrents = await catalog.getAll();
  let parserFailures = 0;
  for (const torrent of allTorrents) {
    for (const source of [torrent.name, ...(torrent.files ?? [])]) {
      if (!source) continue;
      try {
        if (!parseTorrentTitle(source).title) parserFailures++;
      } catch {
        parserFailures++;
      }
    }
  }

  const matched = matchSuggestions(
    pendingRequests.map((request) => ({
      id: request.id,
      title: request.title,
      media_type: request.media_type ?? '',
      release_date: request.release_date,
      season_number: request.season_number,
    })),
    allTorrents,
  );

  let withSuggestion = 0;
  const scores: number[] = [];
  const entries: SuggestionEntry[] = pendingRequests.map((request) => {
    const match = matched.get(request.id);
    const suggestion = match ? { hash: match.hash, score: match.score } : null;
    if (suggestion) {
      withSuggestion++;
      scores.push(suggestion.score);
    }
    return { requestId: request.id, suggestion };
  });

  await requestService.recordSuggestionBatch(entries);

  return {
    pending: pendingRequests.length,
    suggestions: withSuggestion,
    medianScore: median(scores),
    parserFailures,
  };
}

registerJobType('transmission_sync', createTransmissionSyncHandler({
  requestService,
  logger,
  adapter: transmissionAdapter,
  catalog: transmissionCatalog,
}));
