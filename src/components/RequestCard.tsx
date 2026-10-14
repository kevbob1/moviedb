'use client';

import Image from 'next/image';

import { actionToButtonVariant, canCancel, getAvailableActions, STATUS_CONFIG, statusToPill } from '@/lib/request-lifecycle/projection';
import { useRequestActions } from '@/lib/request-lifecycle/use-request-actions';
import { getGenreNames } from '@/lib/genres';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { Request } from '@/lib/request-lifecycle';
import { ReleaseDate } from './ReleaseDate';

interface RequestCardProps {
  request: Request;
  jellyfinAvailable?: boolean;
  formattedDate?: string;
  onAfter?: () => void;
  onAfterCancel?: () => void;
}

export default function RequestCard({
  request,
  jellyfinAvailable = false,
  formattedDate,
  onAfter,
  onAfterCancel,
}: RequestCardProps) {
  const statusConfig = STATUS_CONFIG[request.status];
  const actions = getAvailableActions(request.status);
  const { fulfill, download, cancel, isPending } = useRequestActions({ request, onAfter, onAfterCancel });

  const actionHandlers = { download, fulfill } as const;

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
          className="block w-14 max-w-[35vw] flex-shrink-0 sm:w-20"
        >
          <Image
            src={posterUrl}
            alt={request.title}
            width={80}
            height={120}
            sizes="(max-width: 639px) 56px, 80px"
            className="h-auto w-full rounded-lg"
          />
        </a>
      ) : (
        <div className="aspect-[2/3] w-14 max-w-[35vw] flex-shrink-0 rounded-lg bg-surface sm:w-20" />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-base font-semibold leading-snug text-foreground">
          {request.title}
          {request.season_number && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">— S{request.season_number}</span>
          )}
          {request.release_date && <ReleaseDate date={request.release_date} mediaType={request.media_type} />}
        </h3>
        <div className="mt-1 flex flex-wrap gap-1">
          <Pill variant={statusToPill(request.status)} label={statusConfig.label} />
          {request.media_type === 'tv' && <Pill variant="downloading" label="TV" />}
          {jellyfinAvailable && <Pill variant="available" label="On Jellyfin" />}
        </div>
        {request.genre_ids && request.genre_ids.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{getGenreNames(request.genre_ids).join(', ')}</p>
        )}

        <div className="mt-1 min-h-10">
          {request.overview && <p className="line-clamp-2 text-sm text-muted-foreground">{request.overview}</p>}
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Requested by {request.requested_by} · {formattedDate ?? new Date(request.requested_at).toLocaleDateString()}
        </p>

        <div className="mt-3 flex min-h-8 flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.action}
              size="sm"
              variant={actionToButtonVariant(action.action)}
              loading={isPending}
              onClick={() => actionHandlers[action.action]()}
            >
              {action.label}
            </Button>
          ))}
          {canCancel(request.status) && (
            <Button size="sm" variant="danger" loading={isPending} onClick={cancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Surface>
  );
}
