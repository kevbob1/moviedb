import { and, eq, inArray } from 'drizzle-orm';

import { db, type Tx } from '../../../drizzle/db';
import { jobs } from '../../../drizzle/schema';
import { logger } from '@/lib/logger';

import type { JobPayloads, JobStatus, JobType, SyncPayload } from './contracts';

export interface EnqueueResult {
  queued: boolean;
  job: {
    status: JobStatus;
    queuedAt: string;
  };
}

interface OutstandingJob {
  id: number;
  status: JobStatus;
  payload: unknown;
  created_at: Date;
}

/** Attempts allowed when a unique violation costs us the insert race. */
const MAX_ENQUEUE_ATTEMPTS = 2;

async function findOutstandingSync(): Promise<OutstandingJob | null> {
  const [row] = await db
    .select({
      id: jobs.id,
      status: jobs.status,
      payload: jobs.payload,
      created_at: jobs.createdAt,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.type, 'transmission_sync'),
        inArray(jobs.status, ['pending', 'processing']),
      ),
    )
    .limit(1);
  return row ? { ...row, status: row.status as JobStatus } : null;
}

function isTransmissionSyncPayload(payload: unknown): payload is SyncPayload {
  return typeof payload === 'object'
    && payload !== null
    && 'trigger' in payload
    && (payload.trigger === 'scheduled' || payload.trigger === 'manual');
}

/** Every "not queued" exit funnels through here, including the race loser. */
async function settleOutstanding(
  outstanding: OutstandingJob,
  payload: SyncPayload,
): Promise<EnqueueResult> {
  if (payload.trigger === 'manual' && outstanding.status === 'pending'
    && !(isTransmissionSyncPayload(outstanding.payload) && outstanding.payload.trigger === 'manual')) {
    await db
      .update(jobs)
      .set({ payload: { trigger: 'manual' }, updatedAt: new Date() })
      .where(eq(jobs.id, outstanding.id));
  }
  logger.debug({ jobId: outstanding.id }, 'transmission_sync already outstanding, skipping enqueue');
  return {
    queued: false,
    job: {
      status: outstanding.status,
      queuedAt: outstanding.created_at.toISOString(),
    },
  };
}

/**
 * The singleton guard is a partial unique index, so the conflict surfaces as
 * Postgres' own unique-violation SQLSTATE (23505) rather than a Prisma error.
 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === '23505';
}

/**
 * `transmission_sync` is a singleton while live: the partial unique index
 * jobs_singleton_live_type_key (see prisma/migrations/20261020050000) rejects a
 * second pending/processing row, so enqueueing settles for the outstanding one.
 */
async function enqueueTransmissionSync(payload: SyncPayload): Promise<EnqueueResult> {
  const outstanding = await findOutstandingSync();
  if (outstanding) {
    return settleOutstanding(outstanding, payload);
  }

  // The fast path above is not a lock: a concurrent caller can insert between
  // the find and the create. The partial unique index turns that race into a
  // duplicate-key error instead of a duplicate row, so the loser reports
  // queued: false rather than inserting twice.
  for (let attempt = 1; attempt <= MAX_ENQUEUE_ATTEMPTS; attempt++) {
    try {
      const [job] = await db
        .insert(jobs)
        .values({
          type: 'transmission_sync',
          payload: { trigger: payload.trigger },
          status: 'pending',
          updatedAt: new Date(),
        })
        .returning({ created_at: jobs.createdAt });
      if (!job) {
        throw new Error('transmission_sync enqueue returned no row');
      }
      logger.info('transmission_sync job enqueued');
      return { queued: true, job: { status: 'pending', queuedAt: job.created_at.toISOString() } };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const winner = await findOutstandingSync();
      if (winner) {
        return settleOutstanding(winner, payload);
      }
      // The winner finished before we could read it; the slot is free again.
      if (attempt === MAX_ENQUEUE_ATTEMPTS) throw error;
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new Error('transmission_sync enqueue exhausted its attempts');
}

/** Notification jobs never coalesce: every request gets its own email job. */
async function insertPending<T extends JobType>(
  type: T,
  payload: JobPayloads[T],
): Promise<EnqueueResult> {
  const [job] = await db
    .insert(jobs)
    .values({ type, payload, status: 'pending', updatedAt: new Date() })
    .returning({ created_at: jobs.createdAt });
  if (!job) {
    throw new Error(`${type} enqueue returned no row`);
  }
  return { queued: true, job: { status: 'pending', queuedAt: job.created_at.toISOString() } };
}

type EnqueueStrategies = {
  [K in JobType]: (payload: JobPayloads[K]) => Promise<EnqueueResult>;
};

/** One policy per type: only the sync job has a coalescing rule. */
const STRATEGIES: EnqueueStrategies = {
  transmission_sync: (payload) => enqueueTransmissionSync(payload),
  request_notification: (payload) => insertPending('request_notification', payload),
  tv_series_request_notification: (payload) => insertPending('tv_series_request_notification', payload),
};

export async function enqueue<T extends JobType>(
  type: T,
  payload: JobPayloads[T],
): Promise<EnqueueResult> {
  const strategy = STRATEGIES[type] as (value: JobPayloads[T]) => Promise<EnqueueResult>;
  return strategy(payload);
}

/** The transaction verb's signature; a seam other modules can inject. */
export type EnqueueJob = <T extends JobType>(
  tx: Tx,
  type: T,
  payload: JobPayloads[T],
) => Promise<void>;

/**
 * The transaction-threaded verb: callers enqueue from inside the transaction
 * that wrote the row the job is about, so the job exists only if that write
 * committed.
 */
export async function enqueueInTx<T extends JobType>(
  tx: Tx,
  type: T,
  payload: JobPayloads[T],
): Promise<void> {
  // `updated_at` has no database default (Prisma's `@updatedAt` wrote it), so
  // the insert supplies it explicitly.
  await tx.insert(jobs).values({ type, payload, status: 'pending', updatedAt: new Date() });
}
