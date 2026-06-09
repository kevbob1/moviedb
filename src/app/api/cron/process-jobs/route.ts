import { processPendingJobs } from '@/lib/job-queue';
import '@/lib/jobs';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function handler() {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = (await headers()).get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await processPendingJobs();

    return NextResponse.json({
      status: 'ok',
      processed: result.processed,
      failed: result.failed,
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Process jobs cron failed');
    return NextResponse.json({ status: 'error', message: 'Job processing failed' }, { status: 500 });
  }
}

export const GET = withLogging(handler);
