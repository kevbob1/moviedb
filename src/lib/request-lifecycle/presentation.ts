/**
 * Client-safe presentation vocabulary for Requests.
 *
 * This module has no server imports (no database client, schema, logger, TMDB,
 * or jobs) so client components can import it without dragging the server half
 * of the module into a client bundle. The server read/write paths (`./queries`,
 * `./lifecycle`) re-export these names, and `./index` is the server barrier.
 */

export type RequestStatus = 'pending' | 'downloading' | 'fulfilled';

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
