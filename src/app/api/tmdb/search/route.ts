import { NextRequest, NextResponse } from 'next/server';
import { searchTMDBMovies } from '@/lib/tmdb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchTMDBMovies(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('TMDB search failed:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}