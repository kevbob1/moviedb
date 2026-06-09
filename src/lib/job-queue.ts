import { prisma } from './prisma';
import { logger } from './logger';

const STUCK_THRESHOLD_MINUTES = 5;
const BATCH_SIZE = 10;

interface JobHandler<T> {
  handle: (payload: T) => Promise<void>;
}

const handlers = new Map<string, JobHandler<unknown>>();

export function registerJobType<T>(type: string, handler: JobHandler<T>): void {
  handlers.set(type, handler as JobHandler<unknown>);
}

export async function processJob(job: {
  id: number;
  type: string;
  payload: unknown;
}): Promise<void> {
  const handler = handlers.get(job.type);
  if (!handler) {
    throw new Error(`No handler for job type: ${job.type}`);
  }
  await handler.handle(job.payload);
}

export interface ProcessResult {
  processed: number;
  failed: number;
}

export async function processPendingJobs(): Promise<ProcessResult> {
  const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000);

  await prisma.job.updateMany({
    where: {
      status: 'processing',
      updated_at: { lt: stuckCutoff },
    },
    data: { status: 'pending' },
  });

  const pendingJobs = await prisma.job.findMany({
    where: { status: 'pending' },
    orderBy: { created_at: 'asc' },
    take: BATCH_SIZE,
  });

  let processed = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    const claimResult = await prisma.job.updateMany({
      where: { id: job.id, status: 'pending' },
      data: { status: 'processing', attempts: { increment: 1 } },
    });

    if (claimResult.count === 0) {
      continue;
    }

    const currentAttempts = job.attempts + 1;

    try {
      await processJob(job);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'completed', completed_at: new Date() },
      });
      processed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
      logger.error({ err: error, jobId: job.id, jobType: job.type }, 'Job failed');

      if (errorMessage.startsWith('No handler for job type:')) {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'failed', error: errorMessage },
        });
        failed++;
        continue;
      }

      if (currentAttempts >= job.maxAttempts) {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'failed', error: errorMessage },
        });
        failed++;
      } else {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'pending', error: errorMessage },
        });
      }
    }
  }

  return { processed, failed };
}
