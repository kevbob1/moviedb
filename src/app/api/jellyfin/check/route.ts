import { NextRequest, NextResponse } from 'next/server';
import { checkMovieOnJellyfin, checkMoviesOnJellyfin } from '@/lib/jellyfin';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ids = searchParams.get('ids')?.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: 'No valid movie IDs provided' }, { status: 400 });
  }

  try {
    let result;
    if (ids.length === 1) {
      result = await checkMovieOnJellyfin(ids[0]);
    } else {
      result = await checkMoviesOnJellyfin(ids);
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Jellyfin check failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check Jellyfin status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
