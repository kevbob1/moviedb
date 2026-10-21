import { processPendingJobs, registerJobType } from '@/lib/job-queue';
import {
  enqueueTransmissionSync,
  transmissionSyncHandler,
} from '@/lib/jobs/transmission-sync';
import { requestNotificationHandler } from '@/lib/jobs/request-notification';
import { tvSeriesRequestNotificationHandler } from '@/lib/jobs/tv-series-request-notification';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';
import { requireCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

// The single registration seam: the handler map is populated here, explicitly,
// rather than via an import-for-side-effects barrel. Registration is idempotent
// (Map.set), so the modules' own module-level registrations harmlessly repeat.
registerJobType('transmission_sync', transmissionSyncHandler);
registerJobType('request_notification', requestNotificationHandler);
registerJobType('tv_series_request_notification', tvSeriesRequestNotificationHandler);

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
