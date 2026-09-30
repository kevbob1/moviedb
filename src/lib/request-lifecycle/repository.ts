import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { createTmdbClient, TmdbClient } from '@/lib/tmdb';
import { logger } from '@/lib/logger';
import {
  canTransition,
  InvalidTransitionError,
  RequestStatus,
  resolveSideEffects,
} from './fsm';
import { Request, toRequestModel } from './projection';
import { CreateRequestInput, validateCreateRequestInput, validateRequestedBy } from './validators';

export type EnqueueJob = (
  tx: Prisma.TransactionClient,
  type: string,
  payload: Prisma.InputJsonValue,
) => Promise<void>;

/**
 * A suggestion is considered stale once it is older than this, which gates
 * re-computation in the needs-match read used by the suggestion job.
 */
const SUGGESTION_MAX_AGE_MS = 60_000;

/** A pending request that has not been linked to a torrent yet. */
const NEEDS_MATCH_WHERE = {
  status: 'pending',
  torrent_hash: null,
} satisfies Prisma.RequestWhereInput;

/** A downloading request whose torrent has reported a problem. */
const NEEDS_ATTENTION_WHERE = {
  status: 'downloading',
  torrent_problem: { not: null },
} satisfies Prisma.RequestWhereInput;

function needsMatchWhere(now: () => Date, applySuggestionAgeGate: boolean): Prisma.RequestWhereInput {
  if (!applySuggestionAgeGate) return NEEDS_MATCH_WHERE;

  return {
    ...NEEDS_MATCH_WHERE,
    OR: [
      { suggestion_computed_at: { lt: new Date(now().getTime() - SUGGESTION_MAX_AGE_MS) } },
      { suggestion_computed_at: { equals: null } },
    ],
  };
}

export interface RequestServiceDeps {
  prisma: PrismaClient;
  enqueueJob: EnqueueJob;
  now?: () => Date;
  tmdb?: TmdbClient;
}

/**
 * The job layer's verdict after observing a linked torrent: either the
 * download finished (`fulfilled`) or something is wrong (`problem`).
 * Applied atomically by `applySyncDecisions`.
 */
export type SyncDecision =
  | { requestId: number; outcome: 'fulfilled' }
  | { requestId: number; outcome: 'problem'; problem: string };

/** A computed suggestion (or its absence) for one pending request. */
export type SuggestionEntry = {
  requestId: number;
  suggestion: { hash: string; score: number } | null;
};

export interface RequestService {
  createRequest(input: CreateRequestInput): Promise<Request>;
  createTvRequests(tmdbId: number, requestedBy: string): Promise<Request[]>;
  linkTorrent(reqId: number, torrentHash: string): Promise<Request>;
  transitionToStatus(reqId: number, target: RequestStatus): Promise<Request>;
  fulfillRequest(reqId: number): Promise<Request>;
  downloadRequest(reqId: number): Promise<Request>;
  cancelRequest(reqId: number): Promise<void>;
  applySyncDecisions(decisions: SyncDecision[]): Promise<void>;
  recordSuggestionBatch(entries: SuggestionEntry[]): Promise<void>;
  downloadingRequestsWithHashes(): Promise<Array<{ id: number; torrent_hash: string }>>;
  queueStats(): Promise<{ needsMatch: number; needsAttention: number }>;
  pendingRequestsForNeedsMatch(options?: { applySuggestionAgeGate?: boolean }): Promise<Request[]>;
  downloadingRequestsWithTorrentProblems(): Promise<Request[]>;
  activeRequestsForSummary(): Promise<Request[]>;
  retireResolved(olderThanDays: number): Promise<number>;
}

export function createRequestService({ prisma, enqueueJob, now = () => new Date(), tmdb }: RequestServiceDeps): RequestService {
  async function createRequest(input: CreateRequestInput): Promise<Request> {
    const validation = validateCreateRequestInput(input);
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    const existing = await prisma.request.findFirst({
      where: {
        tmdb_id: input.tmdbId,
        season_number: input.seasonNumber ?? null,
      },
    });
    if (existing) {
      logger.info(
        { tmdbId: input.tmdbId, seasonNumber: input.seasonNumber, title: input.title, requestId: existing.id },
        'Request already exists'
      );
      return toRequestModel(existing);
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.request.create({
        data: {
          tmdb_id: input.tmdbId,
          title: input.title,
          poster_path: input.posterPath,
          requested_by: input.requestedBy,
          status: 'pending',
          media_type: input.mediaType,
          season_number: input.seasonNumber ?? null,
          release_date: input.releaseDate,
          overview: input.overview,
          genre_ids: input.genreIds ?? [],
        },
      });

      await enqueueJob(tx, 'request_notification', { ...row } as Prisma.InputJsonValue);

      return row;
    });

    logger.info(
      {
        requestId: created.id,
        tmdbId: input.tmdbId,
        seasonNumber: input.seasonNumber,
        title: input.title,
        mediaType: input.mediaType,
        requestedBy: input.requestedBy,
      },
      'Request created'
    );

    return toRequestModel(created);
  }

  async function createTvRequests(tmdbId: number, requestedBy: string): Promise<Request[]> {
    const validation = validateRequestedBy(requestedBy);
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    const details = await (tmdb ?? createTmdbClient()).tvDetails(tmdbId);
    const seasons = details.seasons.filter((s) => s.season_number > 0);

    const rows = await prisma.$transaction(async (tx) => {
      const created: Awaited<ReturnType<typeof tx.request.create>>[] = [];

      for (const season of seasons) {
        const existing = await tx.request.findFirst({
          where: { tmdb_id: tmdbId, season_number: season.season_number },
        });

        if (existing) {
          created.push(existing);
          continue;
        }

        const row = await tx.request.create({
          data: {
            tmdb_id: tmdbId,
            title: details.name,
            poster_path: season.poster_path ?? null,
            requested_by: requestedBy,
            status: 'pending',
            media_type: 'tv',
            season_number: season.season_number,
          },
        });
        created.push(row);
      }

      await enqueueJob(tx, 'tv_series_request_notification', {
        title: details.name,
        requestedBy,
        seasons: seasons.map((s) => s.season_number),
        totalSeasons: seasons.length,
        posterPath: details.poster_path ?? null,
        releaseDate: details.first_air_date ?? null,
      } as Prisma.InputJsonValue);

      return created;
    });

    logger.info({ tmdbId, seasonCount: seasons.length, requestedBy }, 'TV show fan-out complete');

    return rows.map(toRequestModel);
  }

  async function transitionToStatus(reqId: number, target: RequestStatus): Promise<Request> {
    const existing = await prisma.request.findUnique({ where: { id: reqId } });
    if (!existing) {
      throw new Error('Request not found');
    }

    const from = existing.status as RequestStatus;
    if (!canTransition(from, target)) {
      throw new InvalidTransitionError(`Cannot transition from ${from} to ${target}`);
    }

    const sideEffects = resolveSideEffects(target, now);
    const row = await prisma.request.update({
      where: { id: reqId },
      data: sideEffects,
    });
    return toRequestModel(row);
  }

  async function linkTorrent(reqId: number, torrentHash: string): Promise<Request> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.request.findUnique({ where: { id: reqId } });
      if (!existing) {
        throw new Error('Request not found');
      }

      const from = existing.status as RequestStatus;
      if (!canTransition(from, 'downloading')) {
        throw new InvalidTransitionError(`Cannot transition from ${from} to downloading`);
      }

      const sideEffects = resolveSideEffects('downloading', now);
      const row = await tx.request.update({
        where: { id: reqId },
        data: { ...sideEffects, torrent_hash: torrentHash },
      });
      return toRequestModel(row);
    });
  }

  function fulfillRequest(reqId: number): Promise<Request> {
    return transitionToStatus(reqId, 'fulfilled');
  }

  function downloadRequest(reqId: number): Promise<Request> {
    return transitionToStatus(reqId, 'downloading');
  }

  async function cancelRequest(reqId: number): Promise<void> {
    await prisma.request.delete({ where: { id: reqId } });
  }

  async function applySyncDecisions(decisions: SyncDecision[]): Promise<void> {
    if (decisions.length === 0) return;

    // One transaction for the whole batch: Postgres gives atomicity for free,
    // so a bad row aborts every decision rather than applying a partial batch.
    await prisma.$transaction(async (tx) => {
      for (const decision of decisions) {
        if (decision.outcome === 'fulfilled') {
          await tx.request.update({
            where: { id: decision.requestId },
            data: {
              status: 'fulfilled',
              torrent_problem: null,
              resolved_at: now(),
              suggestion_hash: null,
              suggestion_score: null,
              suggestion_computed_at: null,
            },
          });
        } else {
          await tx.request.update({
            where: { id: decision.requestId },
            data: { torrent_problem: decision.problem },
          });
        }
      }
    });
  }

  async function recordSuggestionBatch(entries: SuggestionEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const computedAt = now();
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await tx.request.update({
          where: { id: entry.requestId },
          data: entry.suggestion
            ? {
                suggestion_hash: entry.suggestion.hash,
                suggestion_score: entry.suggestion.score,
                suggestion_computed_at: computedAt,
              }
            : {
                suggestion_hash: null,
                suggestion_score: null,
                suggestion_computed_at: computedAt,
              },
        });
      }
    });
  }

  async function downloadingRequestsWithHashes(): Promise<Array<{ id: number; torrent_hash: string }>> {
    const rows = await prisma.request.findMany({
      where: { status: 'downloading', torrent_hash: { not: null } },
      select: { id: true, torrent_hash: true },
    });
    return rows.flatMap((row) =>
      row.torrent_hash === null ? [] : [{ id: row.id, torrent_hash: row.torrent_hash }],
    );
  }

  async function queueStats(): Promise<{ needsMatch: number; needsAttention: number }> {
    const [needsMatch, needsAttention] = await Promise.all([
      prisma.request.count({
        where: NEEDS_MATCH_WHERE,
      }),
      prisma.request.count({
        where: NEEDS_ATTENTION_WHERE,
      }),
    ]);
    return { needsMatch, needsAttention };
  }

  async function pendingRequestsForNeedsMatch(
    { applySuggestionAgeGate = false }: { applySuggestionAgeGate?: boolean } = {},
  ): Promise<Request[]> {
    const rows = await prisma.request.findMany({
      where: needsMatchWhere(now, applySuggestionAgeGate),
      orderBy: { requested_at: 'desc' },
    });
    return rows.map(toRequestModel);
  }

  async function downloadingRequestsWithTorrentProblems(): Promise<Request[]> {
    const rows = await prisma.request.findMany({
      where: NEEDS_ATTENTION_WHERE,
      orderBy: { requested_at: 'desc' },
    });
    return rows.map(toRequestModel);
  }

  async function activeRequestsForSummary(): Promise<Request[]> {
    const rows = await prisma.request.findMany({
      where: {
        status: { in: ['pending', 'downloading'] },
      },
      orderBy: { requested_at: 'desc' },
    });
    return rows.map(toRequestModel);
  }

  async function retireResolved(olderThanDays: number): Promise<number> {
    const cutoff = new Date(now().getTime() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await prisma.request.deleteMany({
      where: {
        status: 'fulfilled',
        resolved_at: { lt: cutoff },
      },
    });
    return result.count;
  }

  return {
    createRequest,
    createTvRequests,
    linkTorrent,
    transitionToStatus,
    fulfillRequest,
    downloadRequest,
    cancelRequest,
    applySyncDecisions,
    recordSuggestionBatch,
    downloadingRequestsWithHashes,
    queueStats,
    pendingRequestsForNeedsMatch,
    downloadingRequestsWithTorrentProblems,
    activeRequestsForSummary,
    retireResolved,
  };
}
