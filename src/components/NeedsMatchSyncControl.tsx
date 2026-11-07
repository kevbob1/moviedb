'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { syncTransmission } from '@/app/actions/transmission-actions';
import type { JobRun, JobStatus } from '@/lib/jobs/contracts';
import { syncRunLabel } from '@/lib/jobs/status';
import { Button } from '@/components/ui/Button';

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 75_000;

interface NeedsMatchSyncControlProps {
  lastSync: JobRun | null;
}

function isAtOrAfterRequestedJob(observedQueuedAt: string, requestedQueuedAt: string): boolean {
  const observedTime = Date.parse(observedQueuedAt);
  const requestedTime = Date.parse(requestedQueuedAt);
  if (Number.isNaN(observedTime) || Number.isNaN(requestedTime)) {
    return observedQueuedAt === requestedQueuedAt;
  }
  return observedTime >= requestedTime;
}

export function NeedsMatchSyncControl({ lastSync }: NeedsMatchSyncControlProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'enqueuing' | 'polling'>('idle');
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestedQueuedAt, setRequestedQueuedAt] = useState<string | null>(null);
  const busyRef = useRef(false);
  const observedRequestedJob = requestedQueuedAt && lastSync
    && isAtOrAfterRequestedJob(lastSync.queuedAt, requestedQueuedAt)
    ? lastSync
    : null;
  const requestedJobIsTerminal = phase === 'polling'
    && observedRequestedJob !== null
    && observedRequestedJob.terminal;
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
      setRequestedQueuedAt(result.job.queuedAt);
      setStatus(result.job.status);
      router.refresh();
      setPhase('polling');
    } catch (caughtError) {
      stopSync();
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to enqueue sync');
    }
  }

  const feedbackStatus = observedRequestedJob?.status ?? status;
  const feedback = error ? `Sync failed: ${error}` : feedbackStatus ? syncRunLabel(feedbackStatus) : null;

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
