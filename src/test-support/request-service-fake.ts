import type { TmdbClient } from '@/lib/tmdb';

import type { EnqueueJob } from '../lib/request-lifecycle/repository';
import { createRequestService } from '../lib/request-lifecycle/repository';
import { makeInMemoryDrizzle, type InMemoryDrizzle, type InMemoryStore } from './fake-drizzle';

/** The instant every lifecycle test pins its injected clock to. */
export const fixedNow = () => new Date('2026-06-15T12:00:00Z');

export const recordingEnqueueJob = () => {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const fn: EnqueueJob = jest.fn(async (_tx, type, payload) => {
    calls.push({ type, payload });
  });
  return { fn, calls };
};

export interface FakeRequestService {
  service: ReturnType<typeof createRequestService>;
  enqueueJob: EnqueueJob;
  store: InMemoryStore;
}

/**
 * Build the composed service over a Drizzle in-memory store, so a test drives
 * real write paths (insert → transition → batch) and inspects the rows they
 * left behind instead of asserting on Prisma call shapes.
 */
export const makeService = (
  fake: InMemoryDrizzle = makeInMemoryDrizzle(),
  options: { tmdb?: TmdbClient } = {},
): FakeRequestService => {
  const { fn: enqueueJob } = recordingEnqueueJob();
  const service = createRequestService({
    db: fake.db,
    enqueueJob,
    now: fixedNow,
    tmdb: options.tmdb,
  });
  return { service, enqueueJob, store: fake.store };
};
