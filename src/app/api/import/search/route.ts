import { NextResponse } from 'next/server';

import { TmdbError } from '@/lib/tmdb';
import { defaultImportFlow } from '@/lib/import-flow';
import { withLogging } from '@/lib/with-logging';

async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const type = searchParams.get('type');

  if (!query || (type !== 'movie' && type !== 'tv')) {
    return NextResponse.json({ error: 'q and type (movie or tv) are required' }, { status: 400 });
  }

  try {
    return NextResponse.json(await defaultImportFlow.search(query, type));
  } catch (error) {
    if (error instanceof TmdbError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    throw error;
  }
}

export const GET = withLogging(handler);
