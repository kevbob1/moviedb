import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkJellyfinConnectivity } from '@/lib/jellyfin';
import { withLogging } from '@/lib/with-logging';

export const dynamic = 'force-static';

async function handler() {
  try {
    const dbConnected = await prisma.$queryRaw`SELECT 1`;
    const dbStatus = dbConnected ? 'ok' : 'error';

    const jellyfinResult = await checkJellyfinConnectivity();
    const jellyfinStatus = !jellyfinResult.configured ? 'not_configured' :
                           jellyfinResult.reachable ? 'ok' : 'error';

    const overallStatus = dbStatus === 'ok' && jellyfinStatus !== 'error' ? 'ok' : 'error';

    return NextResponse.json({
      status: overallStatus,
      database: dbStatus,
      jellyfin: jellyfinStatus
    }, {
      status: overallStatus === 'ok' ? 200 : 503
    });
  } catch {
    return NextResponse.json(
      { status: 'error', database: 'error', jellyfin: 'error' },
      { status: 503 }
    );
  }
}

export const GET = withLogging(handler);
