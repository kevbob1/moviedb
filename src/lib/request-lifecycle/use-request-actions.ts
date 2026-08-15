'use client';

import { useCallback, useState } from 'react';

import { cancelRequest, downloadRequest, fulfillRequest } from '@/app/actions/request-actions';
import { logger } from '@/lib/logger';
import { Request } from './projection';

interface UseRequestActionsOptions {
  request: Request;
  onAfter?: () => void;
  onAfterCancel?: () => void;
}

export interface RequestActions {
  fulfill: () => Promise<void>;
  download: () => Promise<void>;
  cancel: () => Promise<void>;
  isPending: boolean;
}

export function useRequestActions({
  request,
  onAfter,
  onAfterCancel,
}: UseRequestActionsOptions): RequestActions {
  const [isPending, setIsPending] = useState(false);

  const run = useCallback(async (action: () => Promise<unknown>, errorLabel: string): Promise<void> => {
    setIsPending(true);
    try {
      await action();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, errorLabel);
    } finally {
      setIsPending(false);
    }
  }, []);

  const fulfill = useCallback(async () => {
    await run(() => fulfillRequest(request.id), 'Failed to mark as fulfilled');
    onAfter?.();
  }, [run, request.id, onAfter]);

  const download = useCallback(async () => {
    await run(() => downloadRequest(request.id), 'Failed to download');
    onAfter?.();
  }, [run, request.id, onAfter]);

  const cancel = useCallback(async () => {
    await run(() => cancelRequest(request.id), 'Failed to cancel');
    onAfterCancel?.();
  }, [run, request.id, onAfterCancel]);

  return { fulfill, download, cancel, isPending };
}