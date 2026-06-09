import { NextRequest, NextResponse } from 'next/server';
import { getTMDBTVDetails, TMDBSeason } from '@/lib/tmdb';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

async function handler(request: Request | NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids')?.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: 'No valid TV show IDs provided' }, { status: 400 });
  }

  try {
    const results = await Promise.all(
      ids.map(async (id): Promise<{ id: number; seasons: TMDBSeason[] }> => {
        try {
          const details = await getTMDBTVDetails(id);
          return { id, seasons: details.seasons };
        } catch (error) {
          logger.warn({ tmdbId: id, error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to fetch TV details');
          return { id, seasons: [] };
        }
      })
    );

    const seasons: Record<number, TMDBSeason[]> = {};
    for (const result of results) {
      seasons[result.id] = result.seasons;
    }

    return NextResponse.json({ seasons });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'TV seasons fetch failed');
    return NextResponse.json(
      { error: 'Failed to fetch TV seasons', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler);
