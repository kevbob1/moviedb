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

import type { RequestStatus } from './lifecycle';

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

export interface StatusConfig {
  label: string;
}

export const STATUS_CONFIG: Record<RequestStatus, StatusConfig> = {
  pending: { label: 'Pending' },
  downloading: { label: 'Downloading' },
  fulfilled: { label: 'Fulfilled' },
};

export type PillVariant = 'pending' | 'downloading' | 'fulfilled' | 'available';

export const statusToPill = (status: RequestStatus): PillVariant => status;

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger';

export type ActionKind = 'download' | 'fulfill';

export const actionToButtonVariant = (action: ActionKind): ButtonVariant => {
  return action === 'download' ? 'primary' : 'success';
};

export interface RequestAction {
  action: ActionKind;
  label: string;
  nextStatus: RequestStatus;
}

export const getAvailableActions = (status: RequestStatus): RequestAction[] => {
  if (status === 'pending') {
    return [
      { action: 'download', label: 'Start Download', nextStatus: 'downloading' },
      { action: 'fulfill', label: 'Mark Fulfilled', nextStatus: 'fulfilled' },
    ];
  }
  if (status === 'downloading') {
    return [
      { action: 'fulfill', label: 'Mark Fulfilled', nextStatus: 'fulfilled' },
    ];
  }
  return [];
};

export const canCancel = (status: RequestStatus): boolean => status !== 'fulfilled';

export interface Request {
  id: number;
  title: string;
  tmdb_id?: number;
  season_number?: number | null;
  poster_path?: string;
  overview?: string;
  release_date?: string;
  genre_ids?: number[];
  requested_by: string;
  requested_at: string;
  status: RequestStatus;
  media_type?: string;
  torrent_hash?: string | null;
  torrent_problem?: string;
  resolved_at?: string | null;
  suggestion_hash?: string | null;
  suggestion_score?: number | null;
  suggestion_computed_at?: string | null;
}

export const toRequestModel = (row: {
  id: number;
  title: string;
  tmdb_id: number | null;
  poster_path: string | null;
  overview: string | null;
  release_date: string | null;
  genre_ids: number[];
  requested_by: string;
  requested_at: Date;
  status: string;
  season_number: number | null;
  media_type: string | null;
  torrent_hash?: string | null;
  torrent_problem: string | null;
  resolved_at?: Date | null;
  suggestion_hash?: string | null;
  suggestion_score?: number | null;
  suggestion_computed_at?: Date | null;
}): Request => {
  return {
    ...row,
    tmdb_id: row.tmdb_id ?? undefined,
    poster_path: row.poster_path ?? undefined,
    overview: row.overview ?? undefined,
    release_date: row.release_date ?? undefined,
    requested_at: row.requested_at.toISOString(),
    status: row.status as RequestStatus,
    season_number: row.season_number ?? undefined,
    media_type: row.media_type ?? undefined,
    torrent_hash: row.torrent_hash ?? null,
    torrent_problem: row.torrent_problem ?? undefined,
    resolved_at: row.resolved_at ? row.resolved_at.toISOString() : null,
    suggestion_hash: row.suggestion_hash ?? undefined,
    suggestion_score: row.suggestion_score ?? undefined,
    suggestion_computed_at: row.suggestion_computed_at
      ? row.suggestion_computed_at.toISOString()
      : undefined,
  };
};

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export interface CreateRequestInput {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  requestedBy: string;
  releaseDate?: string;
  overview?: string;
  genreIds?: number[];
  mediaType: string;
  seasonNumber?: number;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export const validateCreateRequestInput = (input: CreateRequestInput): ValidationResult => {
  if (!input.title?.trim()) {
    return { ok: false, reason: 'Title is required' };
  }
  if (!input.requestedBy?.trim()) {
    return { ok: false, reason: 'Requester name is required' };
  }
  return { ok: true };
};

export const validateRequestedBy = (requestedBy: string): ValidationResult => {
  if (!requestedBy?.trim()) {
    return { ok: false, reason: 'Requester name is required' };
  }
  return { ok: true };
};

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
  retireResolved(olderThanDays: number): Promise<number>;
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

  /**
   * Retention cleanup. Deletes rather than selects, so it lives on the write
   * side of the same Drizzle client; `returning` makes the count exact without
   * a second round trip.
   */
  async function retireResolved(olderThanDays: number): Promise<number> {
    const cutoff = new Date(now().getTime() - olderThanDays * 24 * 60 * 60 * 1000);
    const removed = await db
      .delete(requests)
      .where(and(eq(requests.status, 'fulfilled'), lt(requests.resolvedAt, cutoff)))
      .returning({ id: requests.id });
    return removed.length;
  }

  return {
    claimedTorrentHashes,
    downloadingRequestsWithHashes,
    queueStats,
    pendingRequestsForNeedsMatch,
    downloadingRequestsWithTorrentProblems,
    activeRequestsForSummary,
    retireResolved,
  };
}
