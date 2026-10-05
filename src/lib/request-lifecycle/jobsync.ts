import { Prisma, PrismaClient } from '@/generated/prisma/client';

import { Request, toRequestModel } from './projection';

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

/**
 * A pending request that has not been linked to a torrent yet.
 * Exported for shared use by tests and consumers that mirror the predicate.
 */
export const NEEDS_MATCH_WHERE = {
  status: 'pending',
  torrent_hash: null,
} satisfies Prisma.RequestWhereInput;

/** A downloading request whose torrent has reported a problem. */
export const NEEDS_ATTENTION_WHERE = {
  status: 'downloading',
  torrent_problem: { not: null },
} satisfies Prisma.RequestWhereInput;

/**
 * A suggestion is considered stale once it is older than this, which gates
 * re-computation in the needs-match read used by the suggestion job.
 */
const SUGGESTION_MAX_AGE_MS = 60_000;

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

export interface RequestJobSyncDeps {
  prisma: PrismaClient;
  now: () => Date;
}

export interface RequestJobSync {
  applySyncDecisions(decisions: SyncDecision[]): Promise<void>;
  recordSuggestionBatch(entries: SuggestionEntry[]): Promise<void>;
  downloadingRequestsWithHashes(): Promise<Array<{ id: number; torrent_hash: string }>>;
  queueStats(): Promise<{ needsMatch: number; needsAttention: number }>;
  pendingRequestsForNeedsMatch(options?: { applySuggestionAgeGate?: boolean }): Promise<Request[]>;
  downloadingRequestsWithTorrentProblems(): Promise<Request[]>;
  activeRequestsForSummary(): Promise<Request[]>;
  retireResolved(olderThanDays: number): Promise<number>;
}

export function createRequestJobSync({ prisma, now }: RequestJobSyncDeps): RequestJobSync {
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
