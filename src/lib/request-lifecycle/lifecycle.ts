import { and, eq, isNull } from 'drizzle-orm';

import type { Db, Tx } from '../../../drizzle/db';
import { requests } from '../../../drizzle/schema';
import type { NewRequestRow } from '../../../drizzle/schema';
import { logger } from '@/lib/logger';
import { createTmdbClient, TmdbClient } from '@/lib/tmdb';

import {
  CreateRequestInput,
  requestColumns,
  Request,
  toRequestModel,
  validateCreateRequestInput,
  validateRequestedBy,
} from './queries';

// ---------------------------------------------------------------------------
// FSM
// ---------------------------------------------------------------------------

export type RequestStatus = 'pending' | 'downloading' | 'fulfilled';

export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ['downloading', 'fulfilled'],
  downloading: ['fulfilled'],
  fulfilled: [],
};

export const canTransition = (from: RequestStatus, to: RequestStatus): boolean => {
  return REQUEST_TRANSITIONS[from].includes(to);
};

export const getAllowedTransitions = (status: RequestStatus): RequestStatus[] => {
  return REQUEST_TRANSITIONS[status];
};

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

export interface TransitionSideEffects {
  status: RequestStatus;
  torrent_problem: string | null;
  resolved_at?: Date;
  suggestion_hash: string | null;
  suggestion_score: number | null;
  suggestion_computed_at: Date | null;
}

export const resolveSideEffects = (to: RequestStatus, now: () => Date): TransitionSideEffects => {
  const base: TransitionSideEffects = {
    status: to,
    torrent_problem: null,
    suggestion_hash: null,
    suggestion_score: null,
    suggestion_computed_at: null,
  };
  if (to === 'fulfilled') {
    return { ...base, resolved_at: now() };
  }
  return base;
};

// ---------------------------------------------------------------------------
// Transition write path
// ---------------------------------------------------------------------------

/**
 * Shared client shape: the root Drizzle client and the transaction handle
 * handed to `db.transaction(fn)` expose the same `select` / `update` surface,
 * so one write path serves both the named verbs (which write on the root
 * client) and the batch verbs (which write inside a transaction).
 */
export type TransitionClient = Pick<Db, 'select' | 'update'>;

/**
 * Extra columns a transition may write alongside the FSM-resolved side
 * effects. Each field is optional so callers pass only what their transition
 * needs; the spread keeps the write atomic with the side effects in a single
 * `update`.
 */
export interface TransitionExtras {
  torrent_hash?: string;
}

/**
 * Why a target Request was left alone. `invalid_transition` carries the status
 * the row is actually in, so the caller can describe it without re-reading.
 */
export type TransitionOutcome =
  | { ok: true; request: Request }
  | { ok: false; skipped: 'not_found' }
  | { ok: false; skipped: 'invalid_transition'; from: RequestStatus };

/**
 * Translate the FSM-resolved side effects (snake_case, the Request projection's
 * vocabulary) into the column names Drizzle writes. `resolved_at` is only
 * present on a fulfillment and `torrent_hash` only when the caller passes it,
 * so both stay absent otherwise — matching the Prisma-era partial write.
 */
function transitionValues(
  effects: TransitionSideEffects,
  extras: TransitionExtras,
): Partial<NewRequestRow> {
  const values: Partial<NewRequestRow> = {
    status: effects.status,
    torrentProblem: effects.torrent_problem,
    suggestionHash: effects.suggestion_hash,
    suggestionScore: effects.suggestion_score,
    suggestionComputedAt: effects.suggestion_computed_at,
  };
  if (effects.resolved_at !== undefined) values.resolvedAt = effects.resolved_at;
  if (extras.torrent_hash !== undefined) values.torrentHash = extras.torrent_hash;
  return values;
}

/**
 * The module's single FSM-aware write path. Every transition — a named verb or
 * a batch verb — resolves its side effects through here, so the set of columns
 * a transition writes has exactly one definition.
 *
 * A skip is not an error: the caller decides what one means. The named verbs
 * throw; the batch verbs count it and carry on.
 *
 * `extras` is written alongside the resolved side effects. The shape is
 * `TransitionExtras` (currently only `torrent_hash`, from `linkTorrent` and
 * `autoLinkBatch`); adding a new column means extending the interface, not
 * widening the type at the call site.
 *
 * Deletion via `cancelRequest` (ADR-0006 cancel=delete) is intentionally
 * outside this write path because it is not a status transition.
 */
export async function applyTransition(
  client: TransitionClient,
  reqId: number,
  target: RequestStatus,
  now: () => Date,
  extras: TransitionExtras = {},
): Promise<TransitionOutcome> {
  const [existing] = await client
    .select(requestColumns)
    .from(requests)
    .where(eq(requests.id, reqId))
    .limit(1);
  if (!existing) {
    return { ok: false, skipped: 'not_found' };
  }

  const from = existing.status as RequestStatus;
  if (!canTransition(from, target)) {
    return { ok: false, skipped: 'invalid_transition', from };
  }

  const [row] = await client
    .update(requests)
    .set(transitionValues(resolveSideEffects(target, now), extras))
    .where(eq(requests.id, reqId))
    .returning(requestColumns);

  // The row can disappear between the read and the write (a concurrent cancel).
  // Report it the same way as a missing read so the batch verbs keep counting.
  if (!row) {
    return { ok: false, skipped: 'not_found' };
  }

  return { ok: true, request: toRequestModel(row) };
}

// ---------------------------------------------------------------------------
// Lifecycle verbs (named transitions)
// ---------------------------------------------------------------------------

export interface RequestLifecycleDeps {
  db: Db;
  now: () => Date;
}

export interface RequestLifecycle {
  linkTorrent(reqId: number, torrentHash: string): Promise<Request>;
  fulfillRequest(reqId: number): Promise<Request>;
  downloadRequest(reqId: number): Promise<Request>;
  cancelRequest(reqId: number): Promise<void>;
}

export function createRequestLifecycle({
  db,
  now,
}: RequestLifecycleDeps): RequestLifecycle {
  /**
   * Internal FSM-aware transition helper. Used by every lifecycle verb:
   * - `fulfillRequest` and `downloadRequest` call it directly via `db`.
   * - `linkTorrent` calls it inside `db.transaction` so the torrent_hash write
   *   is atomic with the transition.
   *
   * It delegates to `applyTransition`, the module's single write path, and maps
   * what that reports to this call site's error modes: a missing Request throws
   * `Request not found`, a disallowed transition throws `InvalidTransitionError`.
   *
   * `transitionToStatus` is deliberately NOT exposed on `RequestLifecycle`:
   * callers must use a named verb so intent is encoded in the call site.
   */
  async function transitionToStatus(
    client: TransitionClient,
    reqId: number,
    target: RequestStatus,
    extras: TransitionExtras = {},
  ): Promise<Request> {
    const outcome = await applyTransition(client, reqId, target, now, extras);
    if (!outcome.ok) {
      if (outcome.skipped === 'not_found') {
        throw new Error('Request not found');
      }
      throw new InvalidTransitionError(`Cannot transition from ${outcome.from} to ${target}`);
    }
    return outcome.request;
  }

  function fulfillRequest(reqId: number): Promise<Request> {
    return transitionToStatus(db, reqId, 'fulfilled');
  }

  function downloadRequest(reqId: number): Promise<Request> {
    return transitionToStatus(db, reqId, 'downloading');
  }

  function linkTorrent(reqId: number, torrentHash: string): Promise<Request> {
    return db.transaction(async (tx) =>
      transitionToStatus(tx, reqId, 'downloading', { torrent_hash: torrentHash }),
    );
  }

  async function cancelRequest(reqId: number): Promise<void> {
    await db.delete(requests).where(eq(requests.id, reqId));
  }

  return {
    linkTorrent,
    fulfillRequest,
    downloadRequest,
    cancelRequest,
  };
}

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export type EnqueueJob = (
  tx: Tx,
  type: string,
  payload: unknown,
) => Promise<void>;

export interface RequestIntakeDeps {
  db: Db;
  enqueueJob: EnqueueJob;
  tmdb?: TmdbClient;
}

export interface RequestIntake {
  createRequest(input: CreateRequestInput): Promise<Request>;
  createTvRequests(tmdbId: number, requestedBy: string): Promise<Request[]>;
}

/** The row shape `requestColumns` selects, i.e. what `toRequestModel` consumes. */
type RequestColumnsRow = Parameters<typeof toRequestModel>[0];

export function createRequestIntake({
  db,
  enqueueJob,
  tmdb,
}: RequestIntakeDeps): RequestIntake {
  async function createRequest(input: CreateRequestInput): Promise<Request> {
    const validation = validateCreateRequestInput(input);
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    // `season_number = null` is `IS NULL` in SQL, not `= NULL`, so the
    // duplicate check picks its predicate by whether a season was given.
    const [existing] = await db
      .select(requestColumns)
      .from(requests)
      .where(
        and(
          eq(requests.tmdbId, input.tmdbId),
          input.seasonNumber == null
            ? isNull(requests.seasonNumber)
            : eq(requests.seasonNumber, input.seasonNumber),
        ),
      )
      .limit(1);
    if (existing) {
      logger.info(
        { tmdbId: input.tmdbId, seasonNumber: input.seasonNumber, title: input.title, requestId: existing.id },
        'Request already exists',
      );
      return toRequestModel(existing);
    }

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(requests)
        .values({
          tmdbId: input.tmdbId,
          title: input.title,
          posterPath: input.posterPath,
          requestedBy: input.requestedBy,
          status: 'pending',
          mediaType: input.mediaType,
          seasonNumber: input.seasonNumber ?? null,
          releaseDate: input.releaseDate,
          overview: input.overview,
          genreIds: input.genreIds ?? [],
        })
        .returning(requestColumns);

      if (!row) {
        throw new Error('Request insert returned no row');
      }

      await enqueueJob(tx, 'request_notification', { ...row });

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
      'Request created',
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

    const rows = await db.transaction(async (tx) => {
      const created: RequestColumnsRow[] = [];

      for (const season of seasons) {
        const [existing] = await tx
          .select(requestColumns)
          .from(requests)
          .where(
            and(
              eq(requests.tmdbId, tmdbId),
              eq(requests.seasonNumber, season.season_number),
            ),
          )
          .limit(1);

        if (existing) {
          created.push(existing);
          continue;
        }

        const [row] = await tx
          .insert(requests)
          .values({
            tmdbId,
            title: details.name,
            posterPath: season.poster_path ?? null,
            requestedBy,
            status: 'pending',
            mediaType: 'tv',
            seasonNumber: season.season_number,
          })
          .returning(requestColumns);

        if (!row) {
          throw new Error('Request insert returned no row');
        }

        created.push(row);
      }

      await enqueueJob(tx, 'tv_series_request_notification', {
        title: details.name,
        requestedBy,
        seasons: seasons.map((s) => s.season_number),
        totalSeasons: seasons.length,
        posterPath: details.poster_path ?? null,
        releaseDate: details.first_air_date ?? null,
      });

      return created;
    });

    logger.info({ tmdbId, seasonCount: seasons.length, requestedBy }, 'TV show fan-out complete');

    return rows.map(toRequestModel);
  }

  return {
    createRequest,
    createTvRequests,
  };
}

// ---------------------------------------------------------------------------
// Job sync (write side)
// ---------------------------------------------------------------------------

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
 * What one batch of sync decisions actually did: the Requests it moved into a
 * new status, and how many it left alone because the row no longer qualified or
 * no longer exists.
 */
export interface SyncApplyResult {
  applied: number[];
  skipped: number;
}

export interface RequestJobSyncDeps {
  db: Db;
  now: () => Date;
}

/**
 * The job layer's full verb set. The write verbs live here; the read verbs
 * (`claimedTorrentHashes` onward) are implemented in `queries.ts`. Callers
 * depend on this one name, composed by `repository.ts`.
 */
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

/** The write-side slice of `RequestJobSync`. */
export type RequestJobSyncWrites = Pick<
  RequestJobSync,
  'applySyncDecisions' | 'recordSuggestionBatch' | 'autoLinkBatch'
>;

export function createRequestJobSyncWrites({
  db,
  now,
}: RequestJobSyncDeps): RequestJobSyncWrites {
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
    await db.transaction(async (tx) => {
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

        // A conditional update reports zero rows for a Request deleted since the
        // observation instead of throwing, so one cancellation cannot take down
        // the decisions that follow it.
        const stamped = await tx
          .update(requests)
          .set({ torrentProblem: decision.problem })
          .where(eq(requests.id, decision.requestId))
          .returning({ id: requests.id });
        if (stamped.length === 0) {
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
    await db.transaction(async (tx) => {
      for (const entry of entries) {
        await tx
          .update(requests)
          .set({
            suggestionHash: entry.suggestion ? entry.suggestion.hash : null,
            suggestionScore: entry.suggestion ? entry.suggestion.score : null,
            suggestionComputedAt: computedAt,
          })
          .where(eq(requests.id, entry.requestId));
      }
    });
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
    await db.transaction(async (tx) => {
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

  return {
    applySyncDecisions,
    recordSuggestionBatch,
    autoLinkBatch,
  };
}
