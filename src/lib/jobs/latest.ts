import { desc, eq } from 'drizzle-orm';

import { db } from '../../../drizzle/db';
import { jobs } from '../../../drizzle/schema';

import type { JobRun, JobStatus, JobType } from './contracts';
import { isTerminalStatus } from './status';

/**
 * Only the singleton job carries a trigger, so lift it defensively: a payload
 * of any other shape simply has no trigger to report.
 */
function triggerFromPayload(type: JobType, payload: unknown): JobRun['trigger'] {
  if (type !== 'transmission_sync') return undefined;
  if (typeof payload !== 'object' || payload === null || !('trigger' in payload)) return undefined;
  const trigger = (payload as { trigger?: unknown }).trigger;
  return trigger === 'manual' || trigger === 'scheduled' ? trigger : undefined;
}

/** The most recent run of `type`, projected to the module's run shape. */
export async function latestRun(type: JobType): Promise<JobRun | null> {
  const [row] = await db
    .select({
      status: jobs.status,
      payload: jobs.payload,
      error: jobs.error,
      createdAt: jobs.createdAt,
      completedAt: jobs.completedAt,
    })
    .from(jobs)
    .where(eq(jobs.type, type))
    .orderBy(desc(jobs.createdAt))
    .limit(1);

  if (!row) return null;

  const status = row.status as JobStatus;
  const trigger = triggerFromPayload(type, row.payload);

  return {
    status,
    queuedAt: row.createdAt.toISOString(),
    finishedAt: row.completedAt?.toISOString() ?? null,
    error: row.error ?? null,
    ...(trigger ? { trigger } : {}),
    terminal: isTerminalStatus(status),
  };
}
