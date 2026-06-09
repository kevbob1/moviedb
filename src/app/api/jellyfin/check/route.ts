import { NextRequest, NextResponse } from 'next/server';
import { checkMoviesOnJellyfin, checkSeasonsOnJellyfin } from '@/lib/jellyfin';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

async function handler(request: Request | NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  const ids = searchParams.get('ids')?.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 });
  }

  try {
    const [moviesResult, seasonsResult] = await Promise.all([
      checkMoviesOnJellyfin(ids),
      checkSeasonsOnJellyfin(ids),
    ]);

    return NextResponse.json({
      results: moviesResult.results,
      seasons: seasonsResult.seasons,
      configured: moviesResult.configured || seasonsResult.configured,
      error: moviesResult.error || seasonsResult.error,
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
