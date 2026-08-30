import { requestService } from '@/lib/request-lifecycle';
import { sendDailySummary } from '@/lib/notifications';
import type { NotificationRequest } from '@/lib/notifications';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

function toNotificationRequests(requests: Awaited<ReturnType<typeof requestService.activeRequestsForSummary>>): NotificationRequest[] {
  return requests.map((r) => ({
    id: r.id,
    title: r.title,
    requested_by: r.requested_by,
    status: r.status,
    requested_at: new Date(r.requested_at),
    release_date: r.release_date ?? null,
    media_type: r.media_type,
    season_number: r.season_number ?? null,
  }));
}

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
    const requests = await requestService.activeRequestsForSummary();

    if (requests.length === 0) {
      logger.info('Skipped daily summary: no active requests');
      return NextResponse.json({ status: 'skipped', count: 0 });
    }

    await sendDailySummary(toNotificationRequests(requests));

    return NextResponse.json({ status: 'ok', count: requests.length });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Daily summary cron failed');
    return NextResponse.json({ status: 'error', message: 'Daily summary failed' }, { status: 500 });
  }
}

export const GET = withLogging(handler);
