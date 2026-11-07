import { enqueue, processPendingJobs, registerAllJobTypes } from '@/lib/jobs';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';
import { requireCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

// The queue's single registration seam. Handlers live in the jobs module and
// register nothing themselves; this route is the one place that wires them in.
// Registration is idempotent (Map.set), so a route module reload is harmless.
registerAllJobTypes();

async function handler() {
  const unauthorized = requireCronAuth(await headers());
  if (unauthorized) return unauthorized;

  try {
    const transmissionSyncEnqueued = await enqueue('transmission_sync', { trigger: 'scheduled' });
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
