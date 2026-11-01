import { NextResponse } from 'next/server';
import { requestService, type RequestQueueStatsPort } from '@/lib/request-lifecycle';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Build the badge-count handler around the queue-stats port. The port defaults
 * to the singleton, so the route wires itself; a test can pass a fake that
 * implements `queueStats` alone.
 */
export function createNeedsMatchCountHandler(
  stats: RequestQueueStatsPort = requestService,
) {
  return async function handler() {
    try {
      const { needsMatch, needsAttention } = await stats.queueStats();
      return NextResponse.json({ needsMatchCount: needsMatch, needsAttentionCount: needsAttention });
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to count needs-match requests');
      return NextResponse.json(
        { error: 'Failed to count needs-match requests', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  };
}

export const GET = withLogging(createNeedsMatchCountHandler());
