import { Request } from '@/types/request';
import { RequestStatus } from '@/lib/request-fsm';

export function toRequestModel(request: {
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
}): Request {
  return {
    ...request,
    tmdb_id: request.tmdb_id ?? undefined,
    poster_path: request.poster_path ?? undefined,
    overview: request.overview ?? undefined,
    release_date: request.release_date ?? undefined,
    requested_at: request.requested_at.toISOString(),
    status: request.status as RequestStatus,
    season_number: request.season_number ?? undefined,
    media_type: request.media_type ?? undefined,
  };
}
