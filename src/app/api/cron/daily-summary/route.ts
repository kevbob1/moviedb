import { prisma } from '@/lib/prisma';
import { sendDailySummary } from '@/lib/notifications';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = (await headers()).get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const requests = await prisma.request.findMany({
      where: {
        status: {
          in: ['pending', 'downloading'],
        },
      },
      orderBy: {
        requested_at: 'desc',
      },
    });

    await sendDailySummary(requests);

    return NextResponse.json({ status: 'ok', count: requests.length });
  } catch (error) {
    console.error('Daily summary cron failed:', error);
    return NextResponse.json({ status: 'error', message: 'Daily summary failed' }, { status: 500 });
  }
}