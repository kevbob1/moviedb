import { processPendingJobs } from '@/lib/job-queue';
import { enqueueTransmissionSync } from '@/lib/jobs/transmission-sync';
import '@/lib/jobs';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';
import { requireCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

async function handler() {
  const unauthorized = requireCronAuth(await headers());
  if (unauthorized) return unauthorized;

  try {
    const transmissionSyncResult = await enqueueTransmissionSync({ trigger: 'scheduled' });
    const transmissionSyncEnqueued = transmissionSyncResult.queued;
    const result = await processPendingJobs();

    return NextResponse.json({
      status: 'ok',
      processed: result.processed,
      failed: result.failed,
      transmissionSyncEnqueued,
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Process jobs cron failed');
    return NextResponse.json({ status: 'error', message: 'Job processing failed' }, { status: 500 });
  }
}

export const GET = withLogging(handler);
