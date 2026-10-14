import { Prisma, PrismaClient } from '@/generated/prisma/client';

import { logger } from '@/lib/logger';

import { Request, toRequestModel } from './projection';
import { applyTransition } from './transitions';

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
 * A per-request verdict to link without operator confirmation (ADR-0009).
 * Applied atomically by `autoLinkBatch`.
 */
export type AutoLinkEntry = {
  requestId: number;
  torrentHash: string;
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

/**
 * What one batch of sync decisions actually did: the Requests it moved into a
 * new status, and how many it left alone because the row no longer qualified or
 * no longer exists.
 */
export interface SyncApplyResult {
  applied: number[];
  skipped: number;
}

export interface RequestJobSync {
  applySyncDecisions(decisions: SyncDecision[]): Promise<SyncApplyResult>;
  recordSuggestionBatch(entries: SuggestionEntry[]): Promise<void>;
  autoLinkBatch(entries: AutoLinkEntry[]): Promise<number[]>;
  claimedTorrentHashes(): Promise<string[]>;
  downloadingRequestsWithHashes(): Promise<Array<{ id: number; torrent_hash: string }>>;
  queueStats(): Promise<{ needsMatch: number; needsAttention: number }>;
  pendingRequestsForNeedsMatch(options?: { applySuggestionAgeGate?: boolean }): Promise<Request[]>;
  downloadingRequestsWithTorrentProblems(): Promise<Request[]>;
  activeRequestsForSummary(): Promise<Request[]>;
  retireResolved(olderThanDays: number): Promise<number>;
}

export function createRequestJobSync({ prisma, now }: RequestJobSyncDeps): RequestJobSync {
  /**
   * ADR-0005: batches observation verdicts into one transaction the module owns.
   * `fulfilled` verdicts go through `applyTransition` so they pick up the FSM
   * side effects every other transition gets; `problem` verdicts stamp
   * `torrent_problem` without moving status, so they are not transitions.
   *
   * A Request the operator moved or deleted between observation and apply is a
   * stale verdict, not an error: it is skipped and counted, leaving the rest of
   * the batch intact.
   */
  async function applySyncDecisions(decisions: SyncDecision[]): Promise<SyncApplyResult> {
    if (decisions.length === 0) return { applied: [], skipped: 0 };

    const applied: number[] = [];
    let skipped = 0;

    // One transaction for the whole batch: Postgres gives atomicity for free,
    // so a bad row aborts every decision rather than applying a partial batch.
    await prisma.$transaction(async (tx) => {
      for (const decision of decisions) {
        if (decision.outcome === 'fulfilled') {
          const outcome = await applyTransition(tx, decision.requestId, 'fulfilled', now);
          if (!outcome.ok) {
            skipped++;
            logger.debug({ requestId: decision.requestId, reason: outcome.skipped }, 'skipped fulfilled sync decision');
          } else {
            applied.push(decision.requestId);
          }
          continue;
        }

        // `updateMany` reports zero rows for a Request deleted since the
        // observation instead of throwing, so one cancellation cannot take down
        // the decisions that follow it.
        const stamped = await tx.request.updateMany({
          where: { id: decision.requestId },
          data: { torrent_problem: decision.problem },
        });
        if (stamped.count === 0) {
          skipped++;
          logger.debug({ requestId: decision.requestId, reason: 'not_found' }, 'skipped problem sync decision');
        }
      }
    });

    return { applied, skipped };
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

  /**
   * ADR-0009: a torrent is claimed while any Request row carries its hash —
   * pending, downloading, or fulfilled. Cancellation deletes the row, which
   * releases the claim; fulfillment keeps it.
   */
  async function claimedTorrentHashes(): Promise<string[]> {
    const rows = await prisma.request.findMany({
      where: { torrent_hash: { not: null } },
      select: { torrent_hash: true },
    });
    return rows.flatMap((row) =>
      row.torrent_hash === null ? [] : [row.torrent_hash],
    );
  }

  /**
   * ADR-0009: link a batch of pending Requests without operator confirmation,
   * through the same write path the named lifecycle verbs use. Requests that
   * are no longer `pending` (an operator got there first, or a prior pass
   * linked them) are skipped rather than aborting the batch; the returned ids
   * are the ones actually linked.
   */
  async function autoLinkBatch(entries: AutoLinkEntry[]): Promise<number[]> {
    if (entries.length === 0) return [];

    const linked: number[] = [];
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const outcome = await applyTransition(
          tx,
          entry.requestId,
          'downloading',
          now,
          { torrent_hash: entry.torrentHash },
        );
        if (!outcome.ok) {
          logger.debug({ requestId: entry.requestId, reason: outcome.skipped }, 'skipped auto-link');
          continue;
        }
        linked.push(entry.requestId);
      }
    });
    return linked;
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
    autoLinkBatch,
    claimedTorrentHashes,
    downloadingRequestsWithHashes,
    queueStats,
    pendingRequestsForNeedsMatch,
    downloadingRequestsWithTorrentProblems,
    activeRequestsForSummary,
    retireResolved,
  };
}
