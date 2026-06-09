'use client';

import { useState, useSyncExternalStore } from 'react';

import { logger } from '@/lib/logger';
import { fulfillRequest, downloadRequest, cancelRequest } from '@/app/actions/request-actions';
import RequestCard, { Request } from './RequestCard';

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

  return (
    <RequestCard
      request={{
        ...request,
        requested_at: mounted ? request.requested_at : request.requested_at,
      }}
      onMarkFulfilled={handleMarkFulfilled}
      onDownload={handleDownload}
      onCancel={handleCancel}
      jellyfinAvailable={jellyfinAvailable}
    />
  );
}

export type { Request };
