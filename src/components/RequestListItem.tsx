'use client';

import Image from 'next/image';
import { RequestStatus, getActionsForStatus, STATUS_CONFIG } from '@/lib/request-fsm';
import { getGenreNames } from '@/lib/genres';
import { fulfillRequest, downloadRequest, cancelRequest } from '@/app/actions/request-actions';

export interface Request {
  id: number;
  title: string;
  tmdb_id?: number;
  poster_path?: string;
  overview?: string;
  release_date?: string;
  genre_ids?: number[];
  requested_by: string;
  requested_at: string;
  status: RequestStatus;
}

interface Props {
  request: Request;
  onRemoved?: () => void;
  jellyfinAvailable?: boolean;
}

export function RequestListItem({ request, onRemoved, jellyfinAvailable = false }: Props) {
  const statusConfig = STATUS_CONFIG[request.status];
  const actions = getActionsForStatus(request.status);

  const handleMarkFulfilled = async () => {
    await fulfillRequest(request.id);
  };

  const handleDownload = async () => {
    await downloadRequest(request.id);
  };

  const handleCancel = async () => {
    await cancelRequest(request.id);
    onRemoved?.();
  };

  const posterUrl = request.poster_path
    ? `https://image.tmdb.org/t/p/w154${request.poster_path}`
    : null;

  return (
    <div className="flex gap-4 p-4 border-b">
      {posterUrl && (
        <div className="w-24 h-36 flex-shrink-0">
          <Image
            src={posterUrl}
            alt={request.title}
            width={96}
            height={144}
            className="w-full h-full object-cover rounded"
          />
        </div>
      )}

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold">{request.title}</h3>
          <span className={`px-2 py-0.5 text-xs rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>

        <p className="text-sm text-muted-foreground mb-2">
          Requested by {request.requested_by} • {new Date(request.requested_at).toLocaleDateString()}
        </p>

        {request.genre_ids && request.genre_ids.length > 0 && (
          <div className="text-sm mb-2">
            {getGenreNames(request.genre_ids).join(', ')}
          </div>
        )}

        {request.overview && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{request.overview}</p>
        )}

        <div className="flex gap-2 mt-2">
          {actions.map((action) => {
            const handleClick =
              action.action === 'fulfill'
                ? handleMarkFulfilled
                : action.action === 'download'
                ? handleDownload
                : action.action === 'cancel'
                ? handleCancel
                : undefined;

            return (
              <button
                key={action.action}
                onClick={(e) => {
                  e.preventDefault();
                  handleClick?.();
                }}
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
              >
                {action.label}
              </button>
            );
          })}
        </div>

        {jellyfinAvailable && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-2">
            Available in Jellyfin
          </span>
        )}
      </div>
    </div>
  );
}