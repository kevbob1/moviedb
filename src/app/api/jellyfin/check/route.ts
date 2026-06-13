import { NextRequest, NextResponse } from 'next/server';
import { availabilityFor, seasonsForMany } from '@/lib/jellyfin';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

async function handler(request: Request | NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  const ids = searchParams.get('ids')?.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 });
  }

  try {
    const [availability, seasons] = await Promise.all([
      availabilityFor(ids),
      seasonsForMany(ids),
    ]);

    const results: Record<number, boolean> = {};
    let configured = false;
    let error: string | undefined;
    for (const [id, v] of Object.entries(availability)) {
      results[Number(id)] = v.available;
      if (v.configured) configured = true;
      if (v.error) error = v.error;
    }
    const seasonMap: Record<number, number[]> = {};
    for (const [id, v] of Object.entries(seasons)) {
      seasonMap[Number(id)] = v.seasons;
      if (v.configured) configured = true;
      if (!error && v.error) error = v.error;
    }

    return NextResponse.json({
      results,
      seasons: seasonMap,
      configured,
      error,
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Jellyfin check failed');
    return NextResponse.json(
      {
        error: 'Failed to check Jellyfin status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler);
