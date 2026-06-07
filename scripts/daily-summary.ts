// scripts/daily-summary.ts
import { prisma } from '../src/lib/prisma';
import { sendDailySummary } from '../src/lib/notifications';
import { logger } from '../src/lib/logger';

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
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Daily summary script failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
