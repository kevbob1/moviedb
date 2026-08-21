import { RequestStatus } from './fsm';

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

export const STATUS_CONFIG: Record<RequestStatus, StatusConfig> = {
  pending: { label: 'Pending', color: 'text-status-pending-text', bgColor: 'bg-status-pending-bg' },
  downloading: { label: 'Downloading', color: 'text-status-downloading-text', bgColor: 'bg-status-downloading-bg' },
  fulfilled: { label: 'Fulfilled', color: 'text-status-fulfilled-text', bgColor: 'bg-status-fulfilled-bg' },
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