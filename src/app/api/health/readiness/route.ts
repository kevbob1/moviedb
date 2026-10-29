import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '../../../../../drizzle/db';
import { ping as jellyfinPing } from '@/lib/jellyfin';
import { ping as transmissionPing } from '@/lib/transmission';
import { withLogging } from '@/lib/with-logging';

export const dynamic = 'force-static';

async function handler() {
  try {
    // A trivial round trip: resolving proves the pool can hand out a connection.
    const dbConnected = await db.execute(sql`SELECT 1`);
    const dbStatus = dbConnected ? 'ok' : 'error';

    const jellyfinResult = await jellyfinPing();
    const jellyfinStatus = !jellyfinResult.configured ? 'not_configured' :
                           jellyfinResult.reachable ? 'ok' : 'error';

    const transmissionResult = await transmissionPing();
    const transmissionStatus = !transmissionResult.configured
      ? 'not_configured'
      : transmissionResult.reachable
        ? 'ok'
        : 'error';

    const overallStatus = dbStatus === 'ok' && jellyfinStatus !== 'error' && transmissionStatus !== 'error' ? 'ok' : 'error';

    return NextResponse.json({
      status: overallStatus,
      database: dbStatus,
      jellyfin: jellyfinStatus,
      transmission: transmissionStatus,
    }, {
      status: overallStatus === 'ok' ? 200 : 503
    });
  } catch {
    return NextResponse.json(
      { status: 'error', database: 'error', jellyfin: 'error', transmission: 'error' },
      { status: 503 }
    );
  }
}

export const GET = withLogging(handler);
