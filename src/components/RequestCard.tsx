'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getActionsForStatus } from '@/lib/request-fsm';
import { STATUS_CONFIG } from '@/lib/request-theme';
import { getGenreNames } from '@/lib/genres';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { Request } from '@/types/request';

interface RequestCardProps {
  request: Request;
  onMarkFulfilled: () => void | Promise<void>;
  onDownload: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  jellyfinAvailable?: boolean;
  formattedDate?: string;
}

const PILL_VARIANT = {
  pending: 'pending',
  downloading: 'downloading',
  fulfilled: 'fulfilled',
  canceled: 'canceled',
} as const;

const ACTION_VARIANT = {
  download: 'primary',
  fulfill: 'success',
  cancel: 'danger',
} as const;

export default function RequestCard({
  request,
  onMarkFulfilled,
  onDownload,
  onCancel,
  jellyfinAvailable = false,
  formattedDate,
}: RequestCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const statusConfig = STATUS_CONFIG[request.status];
  const actions = getActionsForStatus(request.status);

  const handlerMap: Record<string, () => void | Promise<void>> = {
    fulfill: onMarkFulfilled,
    download: onDownload,
    cancel: onCancel,
  };

  const handleAction = async (handler: () => void | Promise<void>) => {
    setIsLoading(true);
    try { await handler(); } finally { setIsLoading(false); }
  };

  const posterUrl = request.poster_path
    ? `https://image.tmdb.org/t/p/w154${request.poster_path}`
    : null;

  return (
    <Surface elevation="raised" className="flex gap-3 p-3 sm:gap-4 sm:p-4">
      {posterUrl ? (
        <a
          href={`https://www.themoviedb.org/${request.media_type === 'tv' ? 'tv' : 'movie'}/${request.tmdb_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-14 flex-shrink-0 sm:w-20"
        >
          <Image src={posterUrl} alt={request.title} width={80} height={120} className="h-auto w-full rounded-lg object-cover" />
        </a>
      ) : (
        <div className="h-[80px] w-14 flex-shrink-0 rounded-lg bg-surface sm:h-[120px] sm:w-20" />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground">
              {request.title}
              {request.season_number && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">— S{request.season_number}</span>
              )}
              {request.release_date && request.media_type !== 'tv' && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">({request.release_date.split('-')[0]})</span>
              )}
            </h3>
            {request.genre_ids && request.genre_ids.length > 0 && (
              <p className="text-xs text-muted-foreground">{getGenreNames(request.genre_ids).join(', ')}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Pill variant={PILL_VARIANT[request.status]} label={statusConfig.label} />
            {request.media_type === 'tv' && <Pill variant="downloading" label="TV" />}
            {jellyfinAvailable && <Pill variant="available" label="On Jellyfin" />}
          </div>
        </div>

        {request.overview && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{request.overview}</p>
        )}

        <p className="mt-1 text-xs text-muted-foreground">
          Requested by {request.requested_by} · {formattedDate ?? new Date(request.requested_at).toLocaleDateString()}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => {
            const handler = handlerMap[action.action];
            if (!handler) return null;
            return (
              <Button
                key={action.action}
                size="sm"
                variant={ACTION_VARIANT[action.action as keyof typeof ACTION_VARIANT] ?? 'secondary'}
                loading={isLoading}
                onClick={() => handleAction(handler)}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}
