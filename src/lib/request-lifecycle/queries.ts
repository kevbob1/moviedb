import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  type SQL,
} from 'drizzle-orm';

import type { Db } from '../../../drizzle/db';
import { requests } from '../../../drizzle/schema';

import { toRequestModel, type Request } from './presentation';

// ---------------------------------------------------------------------------
// Presentation vocabulary
// ---------------------------------------------------------------------------

// The UI vocabulary (Request model, status config, actions, validators) lives
// in the client-safe `./presentation` module. Re-exported here so existing
// server importers of `./queries` keep working.
export {
  STATUS_CONFIG,
  actionToButtonVariant,
  canCancel,
  getAvailableActions,
  statusToPill,
  toRequestModel,
  validateCreateRequestInput,
  validateRequestedBy,
} from './presentation';
export type {
  ActionKind,
  ButtonVariant,
  CreateRequestInput,
  PillVariant,
  Request,
  RequestAction,
  StatusConfig,
  ValidationResult,
} from './presentation';

// ---------------------------------------------------------------------------
// Read predicates (Drizzle — Phase 2a)
// ---------------------------------------------------------------------------

/**
 * Drizzle projection of the Request table in the snake_case shape
 * `toRequestModel` consumes, so the read path does not need a second mapper.
 * Exported because the write path selects and returns the same shape inside its
 * transactions — one projection, one mapper.
 */
export const requestColumns = {
  id: requests.id,
  title: requests.title,
  tmdb_id: requests.tmdbId,
  season_number: requests.seasonNumber,
  poster_path: requests.posterPath,
  overview: requests.overview,
  release_date: requests.releaseDate,
  genre_ids: requests.genreIds,
  requested_by: requests.requestedBy,
  requested_at: requests.requestedAt,
  status: requests.status,
  media_type: requests.mediaType,
  torrent_hash: requests.torrentHash,
  torrent_problem: requests.torrentProblem,
  resolved_at: requests.resolvedAt,
  suggestion_hash: requests.suggestionHash,
  suggestion_score: requests.suggestionScore,
  suggestion_computed_at: requests.suggestionComputedAt,
} as const;

/**
 * A pending request that has not been linked to a torrent yet.
 * Exported for shared use by tests and consumers that mirror the predicate.
 */
export const NEEDS_MATCH_WHERE: SQL = and(
  eq(requests.status, 'pending'),
  isNull(requests.torrentHash),
)!;

/** A downloading request whose torrent has reported a problem. */
export const NEEDS_ATTENTION_WHERE: SQL = and(
  eq(requests.status, 'downloading'),
  isNotNull(requests.torrentProblem),
)!;

/**
 * A suggestion is considered stale once it is older than this, which gates
 * re-computation in the needs-match read used by the suggestion job.
 */
const SUGGESTION_MAX_AGE_MS = 60_000;

function needsMatchWhere(now: () => Date, applySuggestionAgeGate: boolean): SQL {
  if (!applySuggestionAgeGate) return NEEDS_MATCH_WHERE;

  return and(
    NEEDS_MATCH_WHERE,
    or(
      lt(requests.suggestionComputedAt, new Date(now().getTime() - SUGGESTION_MAX_AGE_MS)),
      isNull(requests.suggestionComputedAt),
    ),
  )!;
}

// ---------------------------------------------------------------------------
// Operator-facing reads
// ---------------------------------------------------------------------------

/**
 * Rows returned per page by the operator-facing list read. Kept inside the
 * module so callers ask for a page number and never do `skip`/`take`
 * arithmetic themselves.
 */
export const REQUESTS_PER_PAGE = 12;

export interface RequestReadsDeps {
  db: Db;
}

export interface RequestReads {
  /**
   * A page of Requests, newest first, with the total row count and derived
   * page count so callers can render pagination without knowing the page-size
   * arithmetic. `includeResolved` (ADR-0006: a Request is *resolved* once it
   * enters the terminal state) defaults to false, so the default answer is the
   * operator's active queue — `pending` + `downloading`.
   */
  listRequests(options: {
    page: number;
    includeResolved?: boolean;
  }): Promise<{ rows: Request[]; total: number; totalPages: number }>;

  /** A single Request by id, or `null` when no row exists. */
  requestById(id: number): Promise<Request | null>;
}

export function createRequestReads({ db }: RequestReadsDeps): RequestReads {
  async function listRequests({
    page,
    includeResolved = false,
  }: {
    page: number;
    includeResolved?: boolean;
  }): Promise<{ rows: Request[]; total: number; totalPages: number }> {
    const where = includeResolved ? undefined : ne(requests.status, 'fulfilled');

    const skip = (page - 1) * REQUESTS_PER_PAGE;

    const [rows, totals] = await Promise.all([
      db
        .select(requestColumns)
        .from(requests)
        .where(where)
        .orderBy(desc(requests.requestedAt))
        .limit(REQUESTS_PER_PAGE)
        .offset(skip),
      db.select({ value: count() }).from(requests).where(where),
    ]);

    // `count()` comes back as a bigint string from pg.
    const total = Number(totals[0]?.value ?? 0);

    return {
      rows: rows.map(toRequestModel),
      total,
      totalPages: Math.ceil(total / REQUESTS_PER_PAGE),
    };
  }

  async function requestById(id: number): Promise<Request | null> {
    const [row] = await db
      .select(requestColumns)
      .from(requests)
      .where(eq(requests.id, id))
      .limit(1);
    return row ? toRequestModel(row) : null;
  }

  return {
    listRequests,
    requestById,
  };
}

// ---------------------------------------------------------------------------
// Job sync (read side)
// ---------------------------------------------------------------------------

/** The read-side slice of the job layer's verb set. */
export interface RequestJobSyncReads {
  claimedTorrentHashes(): Promise<string[]>;
  downloadingRequestsWithHashes(): Promise<Array<{ id: number; torrent_hash: string }>>;
  queueStats(): Promise<{ needsMatch: number; needsAttention: number }>;
  pendingRequestsForNeedsMatch(options?: { applySuggestionAgeGate?: boolean }): Promise<Request[]>;
  downloadingRequestsWithTorrentProblems(): Promise<Request[]>;
  activeRequestsForSummary(): Promise<Request[]>;
}

export interface RequestJobSyncReadsDeps {
  db: Db;
  now: () => Date;
}

export function createRequestJobSyncReads({
  db,
  now,
}: RequestJobSyncReadsDeps): RequestJobSyncReads {
  /**
   * ADR-0009: a torrent is claimed while any Request row carries its hash —
   * pending, downloading, or fulfilled. Cancellation deletes the row, which
   * releases the claim; fulfillment keeps it.
   */
  async function claimedTorrentHashes(): Promise<string[]> {
    const rows = await db
      .select({ torrent_hash: requests.torrentHash })
      .from(requests)
      .where(isNotNull(requests.torrentHash));
    return rows.flatMap((row) =>
      row.torrent_hash === null ? [] : [row.torrent_hash],
    );
  }

  async function downloadingRequestsWithHashes(): Promise<Array<{ id: number; torrent_hash: string }>> {
    const rows = await db
      .select({ id: requests.id, torrent_hash: requests.torrentHash })
      .from(requests)
      .where(
        and(
          eq(requests.status, 'downloading'),
          isNotNull(requests.torrentHash),
        ),
      );
    return rows.flatMap((row) =>
      row.torrent_hash === null ? [] : [{ id: row.id, torrent_hash: row.torrent_hash }],
    );
  }

  async function queueStats(): Promise<{ needsMatch: number; needsAttention: number }> {
    const [needsMatch, needsAttention] = await Promise.all([
      db.select({ value: count() }).from(requests).where(NEEDS_MATCH_WHERE),
      db.select({ value: count() }).from(requests).where(NEEDS_ATTENTION_WHERE),
    ]);
    return {
      needsMatch: Number(needsMatch[0]?.value ?? 0),
      needsAttention: Number(needsAttention[0]?.value ?? 0),
    };
  }

  async function pendingRequestsForNeedsMatch(
    { applySuggestionAgeGate = false }: { applySuggestionAgeGate?: boolean } = {},
  ): Promise<Request[]> {
    const rows = await db
      .select(requestColumns)
      .from(requests)
      .where(needsMatchWhere(now, applySuggestionAgeGate))
      .orderBy(desc(requests.requestedAt));
    return rows.map(toRequestModel);
  }

  async function downloadingRequestsWithTorrentProblems(): Promise<Request[]> {
    const rows = await db
      .select(requestColumns)
      .from(requests)
      .where(NEEDS_ATTENTION_WHERE)
      .orderBy(desc(requests.requestedAt));
    return rows.map(toRequestModel);
  }

  async function activeRequestsForSummary(): Promise<Request[]> {
    const rows = await db
      .select(requestColumns)
      .from(requests)
      .where(inArray(requests.status, ['pending', 'downloading']))
      .orderBy(desc(requests.requestedAt));
    return rows.map(toRequestModel);
  }

  return {
    claimedTorrentHashes,
    downloadingRequestsWithHashes,
    queueStats,
    pendingRequestsForNeedsMatch,
    downloadingRequestsWithTorrentProblems,
    activeRequestsForSummary,
  };
}
