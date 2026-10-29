import { and, asc, eq, lt, sql } from 'drizzle-orm';

import { db } from '../../drizzle/db';
import { jobs } from '../../drizzle/schema';
import { logger } from './logger';

const STUCK_THRESHOLD_MINUTES = 5;
const BATCH_SIZE = 10;

export interface JobHandler<T> {
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

/**
 * One processing pass over the queue.
 *
 * Every write stamps `updated_at` explicitly: Prisma's `@updatedAt` did that
 * for us, and Drizzle has no equivalent, so the stuck-job sweep would otherwise
 * keep seeing the insert time and reset a job a live worker still owns.
 */
export async function processPendingJobs(): Promise<ProcessResult> {
  const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000);

  await db
    .update(jobs)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(and(eq(jobs.status, 'processing'), lt(jobs.updatedAt, stuckCutoff)));

  const pendingJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, 'pending'))
    .orderBy(asc(jobs.createdAt))
    .limit(BATCH_SIZE);

  let processed = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    // The status predicate makes this an atomic claim: another worker that got
    // there first leaves zero rows to return and we skip the job.
    const claimed = await db
      .update(jobs)
      .set({
        status: 'processing',
        attempts: sql`${jobs.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, 'pending')))
      .returning({ id: jobs.id });

    if (claimed.length === 0) {
      continue;
    }

    const currentAttempts = job.attempts + 1;

    try {
      await processJob(job);
      await db
        .update(jobs)
        .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
        .where(eq(jobs.id, job.id));
      processed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
      logger.error({ err: error, jobId: job.id, jobType: job.type }, 'Job failed');

      if (errorMessage.startsWith('No handler for job type:')) {
        await db
          .update(jobs)
          .set({ status: 'failed', error: errorMessage, updatedAt: new Date() })
          .where(eq(jobs.id, job.id));
        failed++;
        continue;
      }

      if (currentAttempts >= job.maxAttempts) {
        await db
          .update(jobs)
          .set({ status: 'failed', error: errorMessage, updatedAt: new Date() })
          .where(eq(jobs.id, job.id));
        failed++;
      } else {
        await db
          .update(jobs)
          .set({ status: 'pending', error: errorMessage, updatedAt: new Date() })
          .where(eq(jobs.id, job.id));
      }
    }
  }

  return { processed, failed };
}
