import { NextResponse } from 'next/server';

import { defaultImportFlow } from '@/lib/import-flow';
import { withLogging } from '@/lib/with-logging';

async function handler(request: Request): Promise<Response> {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  return NextResponse.json({ seasons: await defaultImportFlow.seasonsFor(id) });
}

export const GET = withLogging(handler);
