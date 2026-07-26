import { NextResponse } from 'next/server';
import { getAll } from '@/lib/transmission';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function handler() {
  try {
    const torrents = await getAll();
    return NextResponse.json({ torrents });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch transmission torrents');
    return NextResponse.json(
      { error: 'Failed to fetch torrents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler);
