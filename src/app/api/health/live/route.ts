import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/with-logging';

export const dynamic = 'force-static';

async function handler() {
  const response = NextResponse.json({ status: 'ok' });
  response.headers.set('Cache-Control', 'no-cache, private, no-store');
  return response;
}

export const GET = withLogging(handler);
