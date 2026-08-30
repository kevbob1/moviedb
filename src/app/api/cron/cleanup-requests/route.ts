import { requestService } from '@/lib/request-lifecycle';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const REQUEST_RETENTION_DAYS = parseInt(process.env.REQUEST_RETENTION_DAYS || '5', 10);

async function handler() {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = (await headers()).get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const deleted = await requestService.retireResolved(REQUEST_RETENTION_DAYS);

    logger.info({ deletedCount: deleted }, 'Cleanup requests cron completed');

    return NextResponse.json({ status: 'ok', deleted });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Cleanup requests cron failed');
    return NextResponse.json({ status: 'error', message: 'Cleanup failed' }, { status: 500 });
  }
}

export const GET = withLogging(handler);
