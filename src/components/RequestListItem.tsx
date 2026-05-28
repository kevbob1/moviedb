'use client';

import { useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { RequestStatus, getActionsForStatus } from '@/lib/request-fsm';
import { STATUS_CONFIG } from '@/lib/request-theme';
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

const ACTION_STYLES: Record<string, string> = {
  download: 'bg-blue-600 hover:bg-blue-700',
  fulfill: 'bg-green-600 hover:bg-green-700',
  cancel: 'bg-red-600 hover:bg-red-700',
};

export function RequestListItem({ request, onRemoved, jellyfinAvailable = false }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const statusConfig = STATUS_CONFIG[request.status];
  const actions = getActionsForStatus(request.status);

  const handleMarkFulfilled = async () => {
    setIsLoading(true);
    try {
      await fulfillRequest(request.id);
    } catch (error) {
      console.error('Failed to mark as fulfilled:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      await downloadRequest(request.id);
    } catch (error) {
      console.error('Failed to download:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      await cancelRequest(request.id);
      setDeleted(true);
      onRemoved?.();
    } catch (error) {
      console.error('Failed to cancel:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (deleted) return null;

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
            {request.release_date && (
              <span className="ml-2 text-sm font-normal text-year">
                ({request.release_date.split('-')[0]})
              </span>
            )}
          </h3>
          <span className={`px-2 py-0.5 text-xs rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
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
          Requested by {request.requested_by} • {mounted ? new Date(request.requested_at).toLocaleDateString() : new Date(request.requested_at).toLocaleDateString('en-US', { timeZone: 'UTC' })}
        </p>

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

            const colorClass = ACTION_STYLES[action.action] || 'bg-primary hover:opacity-90';

            return (
              <button
                key={action.action}
                onClick={(e) => {
                  e.preventDefault();
                  handleClick?.();
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