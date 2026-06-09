'use client';

import { useState, useSyncExternalStore } from 'react';

import { logger } from '@/lib/logger';
import { fulfillRequest, downloadRequest, cancelRequest } from '@/app/actions/request-actions';
import RequestCard from './RequestCard';
import { RequestStatus } from '@/lib/request-fsm';

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
}

interface Props {
  request: Request;
  onRemoved?: () => void;
  jellyfinAvailable?: boolean;
}

export function RequestListItem({ request, onRemoved, jellyfinAvailable = false }: Props) {
  const [deleted, setDeleted] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const handleMarkFulfilled = async () => {
    try {
      await fulfillRequest(request.id);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to mark as fulfilled');
    }
  };

  const handleDownload = async () => {
    try {
      await downloadRequest(request.id);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to download');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelRequest(request.id);
      setDeleted(true);
      onRemoved?.();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cancel');
    }
  };

  if (deleted) return null;

  const formattedDate = mounted
    ? new Date(request.requested_at).toLocaleDateString()
    : new Date(request.requested_at).toLocaleDateString('en-US', { timeZone: 'UTC' });

  return (
    <RequestCard
      request={{
        ...request,
        requested_at: formattedDate,
      }}
      onMarkFulfilled={handleMarkFulfilled}
      onDownload={handleDownload}
      onCancel={handleCancel}
      jellyfinAvailable={jellyfinAvailable}
    />
  );
}
