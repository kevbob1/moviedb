import { NextRequest, NextResponse } from 'next/server';
import { searchTMDBMovies } from '@/lib/tmdb';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

async function handler(request: Request | NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchTMDBMovies(query);
    return NextResponse.json({ results });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'TMDB search failed');
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler);
