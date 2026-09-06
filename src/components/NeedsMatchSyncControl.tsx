'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { syncTransmission } from '@/app/actions/transmission-actions';
import { mapTransmissionSyncStatus } from '@/lib/jobs/transmission-sync-status';
import type { NeedsMatchLastSync } from '@/lib/needs-match/read';
import { Button } from '@/components/ui/Button';

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 75_000;

interface NeedsMatchSyncControlProps {
  lastSync: NeedsMatchLastSync | null;
}

function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'failed';
}

function isAtOrAfterRequestedJob(observedCreatedAt: string, requestedCreatedAt: string): boolean {
  const observedTime = Date.parse(observedCreatedAt);
  const requestedTime = Date.parse(requestedCreatedAt);
  if (Number.isNaN(observedTime) || Number.isNaN(requestedTime)) {
    return observedCreatedAt === requestedCreatedAt;
  }
  return observedTime >= requestedTime;
}

export function NeedsMatchSyncControl({ lastSync }: NeedsMatchSyncControlProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'enqueuing' | 'polling'>('idle');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestedCreatedAt, setRequestedCreatedAt] = useState<string | null>(null);
  const busyRef = useRef(false);
  const observedRequestedJob = requestedCreatedAt && lastSync
    && isAtOrAfterRequestedJob(lastSync.createdAt, requestedCreatedAt)
    ? lastSync
    : null;
  const requestedJobIsTerminal = phase === 'polling'
    && observedRequestedJob !== null
    && isTerminalStatus(observedRequestedJob.status);
  const isBusy = phase !== 'idle' && !requestedJobIsTerminal;

  const stopSync = useCallback(() => {
    busyRef.current = false;
    setPhase('idle');
  }, []);

  useEffect(() => {
    if (phase !== 'polling' || requestedJobIsTerminal) return;

    const interval = window.setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    const timeout = window.setTimeout(stopSync, POLL_TIMEOUT_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [phase, requestedJobIsTerminal, router, stopSync]);

  useEffect(() => {
    if (requestedJobIsTerminal) {
      busyRef.current = false;
      queueMicrotask(stopSync);
    }
  }, [requestedJobIsTerminal, stopSync]);

  async function handleSync() {
    if (busyRef.current) return;

    busyRef.current = true;
    setError(null);
    setPhase('enqueuing');
    try {
      const result = await syncTransmission();
      setRequestedCreatedAt(result.createdAt);
      setStatus(result.status);
      router.refresh();
      setPhase('polling');
    } catch (caughtError) {
      stopSync();
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to enqueue sync');
    }
  }

  const feedbackStatus = observedRequestedJob?.status ?? status;
  const feedback = error ? `Sync failed: ${error}` : feedbackStatus ? mapTransmissionSyncStatus(feedbackStatus) : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleSync} variant="primary" size="sm" loading={isBusy}>
        Sync now
      </Button>
      {feedback && (
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {feedback}
        </p>
      )}
    </div>
  );
}
