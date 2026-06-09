'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getActionsForStatus } from '@/lib/request-fsm';
import { STATUS_CONFIG } from '@/lib/request-theme';
import { getGenreNames } from '@/lib/genres';
import { Request } from '@/types/request';

interface RequestCardProps {
  request: Request;
  onMarkFulfilled: () => void | Promise<void>;
  onDownload: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  jellyfinAvailable?: boolean;
  formattedDate?: string;
}

const ACTION_STYLES: Record<'download' | 'fulfill' | 'cancel', string> = {
  download: 'bg-blue-600 hover:bg-blue-700',
  fulfill: 'bg-green-600 hover:bg-green-700',
  cancel: 'bg-red-600 hover:bg-red-700',
};

export default function RequestCard({
  request,
  onMarkFulfilled,
  onDownload,
  onCancel,
  jellyfinAvailable = false,
  formattedDate,
}: RequestCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const statusConfig = STATUS_CONFIG[request.status];
  const actions = getActionsForStatus(request.status);

  if (error) throw error;

  const handleAction = async (handler: () => void | Promise<void>) => {
    setIsLoading(true);
    try {
      await handler();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  };

  const handlerMap: Record<string, () => void | Promise<void>> = {
    fulfill: onMarkFulfilled,
    download: onDownload,
    cancel: onCancel,
  };

  const posterUrl = request.poster_path
    ? `https://image.tmdb.org/t/p/w154${request.poster_path}`
    : null;

  return (
    <div className="flex gap-4 p-4 border-b">
      {posterUrl && (
        <div className="poster-md">
          <Image
            src={posterUrl}
            alt={request.title}
            width={96}
            height={144}
            className="poster-img"
          />
        </div>
      )}

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold">
            {request.title}
            {request.season_number && (
              <span className="ml-1 text-sm font-normal text-year">
                — Season {request.season_number}
              </span>
            )}
            {request.release_date && request.media_type !== 'tv' && (
              <span className="ml-2 text-sm font-normal text-year">
                ({request.release_date.split('-')[0]})
              </span>
            )}
          </h3>
          <span className={`px-2 py-0.5 text-xs rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          {request.media_type === 'tv' && (
            <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              TV
            </span>
          )}
        </div>

        {request.overview && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
            {request.overview}
          </p>
        )}

        {request.genre_ids && request.genre_ids.length > 0 && (
          <div className="text-sm text-muted-foreground mb-1">
            {getGenreNames(request.genre_ids).join(', ')}
          </div>
        )}

        <p className="text-sm text-muted-foreground mb-2">
          Requested by {request.requested_by} • {formattedDate ?? new Date(request.requested_at).toLocaleDateString()}
        </p>

        <div className="flex gap-2 mt-2">
          {actions.map((action) => {
            const handler = handlerMap[action.action];
            if (!handler) return null;

            const colorClass = ACTION_STYLES[action.action as keyof typeof ACTION_STYLES] || 'bg-primary hover:opacity-90';

            return (
              <button
                key={action.action}
                onClick={(e) => {
                  e.preventDefault();
                  handleAction(handler);
                }}
                disabled={isLoading}
                className={`btn-action ${colorClass}`}
              >
                {isLoading ? 'Loading...' : action.label}
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
