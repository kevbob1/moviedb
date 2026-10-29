jest.mock('../../../drizzle/db', () => {
  const { makeInMemoryDrizzle } = jest.requireActual('../../test-support/fake-drizzle');
  const fake = makeInMemoryDrizzle();
  return { db: fake.db };
});

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { db } from '../../../drizzle/db';
import { renderSql, storeOf } from '../../test-support/fake-drizzle';
import { processJob, processPendingJobs, registerJobType } from '../job-queue';

const store = storeOf(db);

const OLD = new Date('2020-01-01T00:00:00Z');

const seedJob = (overrides: Record<string, unknown> = {}) => {
  const job = {
    id: store.jobs.length + 1,
    type: 'test_type',
    payload: {},
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
    error: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    completed_at: null,
    ...overrides,
  };
  store.jobs.push(job);
  return job;
};

describe('job-queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.jobs.length = 0;
    store.writes.length = 0;
  });

  describe('registerJobType and processJob', () => {
    it('invokes the registered handler for a job type', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      registerJobType('test_type', { handle: handler });

      const job = {
        id: 1,
        type: 'test_type',
        payload: { message: 'hello' },
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        error: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await processJob(job as any);

      expect(handler).toHaveBeenCalledWith({ message: 'hello' });
    });

    it('throws if no handler is registered for job type', async () => {
      const job = {
        id: 99,
        type: 'unknown_type',
        payload: {},
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        error: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(processJob(job as any)).rejects.toThrow('No handler for job type: unknown_type');
    });
  });

  describe('processPendingJobs', () => {
    it('claims pending jobs and processes them', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      registerJobType('claim_test', { handle: handler });

      const job = seedJob({ type: 'claim_test', payload: { a: 1 } });

      const result = await processPendingJobs();

      expect(handler).toHaveBeenCalledWith({ a: 1 });
      // The claim is atomic because it re-asserts `status = 'pending'`, so a
      // worker that lost the race sees zero rows and skips the job.
      const claim = store.writes.find(
        (write) => write.op === 'update' && write.values?.status === 'processing',
      );
      expect(renderSql(claim?.where)?.params).toEqual([1, 'pending']);
      expect(renderSql(claim?.where)?.sql).toContain('"jobs"."id" = $1');
      expect(renderSql(claim?.where)?.sql).toContain('"jobs"."status" = $2');

      expect(job.status).toBe('completed');
      expect(job.attempts).toBe(1);
      expect(job.completed_at).toEqual(expect.any(Date));
      expect(result.processed).toBe(1);
    });

    it('resets stuck processing jobs older than 5 minutes', async () => {
      const job = seedJob({ status: 'processing', updated_at: OLD });

      await processPendingJobs();

      const [reset] = store.writes;
      expect(reset.op).toBe('update');
      expect(renderSql(reset.where)?.sql).toContain('"jobs"."status" = $1');
      expect(renderSql(reset.where)?.sql).toContain('"jobs"."updated_at" < $2');
      expect(renderSql(reset.where)?.params[0]).toBe('processing');
      expect(reset.values).toEqual({ status: 'pending', updatedAt: expect.any(Date) });

      // The sweep ran before the claim, so the reset job is claimable again.
      expect(job.status).not.toBe('processing');
    });

    it('marks a job as failed after max attempts', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('SMTP down'));
      registerJobType('fail_test', { handle: handler });

      const job = seedJob({ type: 'fail_test', attempts: 2, maxAttempts: 3 });

      const result = await processPendingJobs();

      expect(handler).toHaveBeenCalled();
      expect(job.status).toBe('failed');
      expect(job.attempts).toBe(3);
      expect(String(job.error)).toContain('SMTP down');
      expect(result.failed).toBe(1);
    });

    it('resets to pending on failure when attempts remain', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('transient'));
      registerJobType('retry_test', { handle: handler });

      const job = seedJob({ type: 'retry_test', attempts: 1, maxAttempts: 3 });

      const result = await processPendingJobs();

      expect(job.status).toBe('pending');
      expect(String(job.error)).toContain('transient');
      expect(result.failed).toBe(0);
    });

    it('fails unknown job type immediately without retry', async () => {
      const job = seedJob({ type: 'unknown_type' });

      const result = await processPendingJobs();

      expect(job.status).toBe('failed');
      expect(String(job.error)).toContain('No handler for job type:');
      expect(result.failed).toBe(1);
      expect(result.processed).toBe(0);
    });

    it('does not process a job another worker already claimed', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      registerJobType('skip_test', { handle: handler });

      // Fresh `updated_at`, so the stuck sweep leaves it alone and it is not
      // pending: another worker owns it.
      seedJob({ type: 'skip_test', status: 'processing', updated_at: new Date() });

      const result = await processPendingJobs();

      expect(handler).not.toHaveBeenCalled();
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
    });
  });
});
