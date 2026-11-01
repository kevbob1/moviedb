import { requestService, type RequestSummaryPort } from '@/lib/request-lifecycle';
import { sendDailySummary } from '@/lib/notifications';
import type { NotificationRequest } from '@/lib/notifications';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';
import { requireCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

/** One row of the summary read, as consumed by the notification payload. */
type SummaryRequest = Awaited<ReturnType<RequestSummaryPort['activeRequestsForSummary']>>[number];

function toNotificationRequests(requests: SummaryRequest[]): NotificationRequest[] {
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

/**
 * Build the daily-summary handler around the summary port. The port defaults to
 * the singleton, so the route wires itself; a test can pass a fake that
 * implements `activeRequestsForSummary` alone.
 */
export function createDailySummaryHandler(
  summary: RequestSummaryPort = requestService,
) {
  return async function handler() {
    const unauthorized = requireCronAuth(await headers());
    if (unauthorized) return unauthorized;

    try {
      const requests = await summary.activeRequestsForSummary();

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
  };
}

export const GET = withLogging(createDailySummaryHandler());
