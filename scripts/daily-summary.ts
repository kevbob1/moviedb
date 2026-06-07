// scripts/daily-summary.ts
import { prisma } from '../src/lib/prisma';
import { sendDailySummary } from '../src/lib/notifications';

async function main() {
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
  } catch (error) {
    console.error('Daily summary script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
