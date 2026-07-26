import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function handler() {
  try {
    const count = await prisma.request.count({
      where: {
        status: 'pending',
        torrent_hash: null,
      },
    });
    return NextResponse.json({ count });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to count needs-match requests');
    return NextResponse.json(
      { error: 'Failed to count needs-match requests', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler);
