jest.mock('../../../../drizzle/db', () => {
  const { makeInMemoryDrizzle } = jest.requireActual('../../../test-support/fake-drizzle');
  const fake = makeInMemoryDrizzle();
  return { db: fake.db };
});

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { db } from '../../../../drizzle/db';
import { renderSql, storeOf } from '../../../test-support/fake-drizzle';
import { enqueue } from '../enqueue';
import { latestRun } from '../latest';

const store = storeOf(db);

const createdAt = new Date('2026-09-05T11:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  store.jobs.length = 0;
  store.selects.length = 0;
  store.writes.length = 0;
});

const seedSyncJob = (overrides: Record<string, unknown> = {}) => {
  const job = {
    id: store.jobs.length + 1,
    type: 'transmission_sync',
    payload: { trigger: 'scheduled' },
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
    error: null,
    created_at: createdAt,
    updated_at: createdAt,
    completed_at: null,
    ...overrides,
  };
  store.jobs.push(job);
  return job;
};

const insertedJobs = () => store.writes.filter((write) => write.op === 'insert');

describe('enqueue', () => {
  describe('transmission_sync coalescing', () => {
    it('creates a transmission_sync job when none is outstanding', async () => {
      const enqueued = await enqueue('transmission_sync', { trigger: 'scheduled' });

      expect(enqueued).toEqual({
        queued: true,
        job: { status: 'pending', queuedAt: expect.any(String) },
      });

      // The outstanding check still asks the same question of the same index.
      const [query] = store.selects;
      const where = renderSql(query.where);
      expect(where?.params).toEqual(['transmission_sync', 'pending', 'processing']);
      expect(where?.sql).toContain('"jobs"."type" = $1');
      expect(where?.sql).toContain('"jobs"."status" in ($2, $3)');
      expect(query.limit).toBe(1);

      expect(store.jobs).toHaveLength(1);
      expect(store.jobs[0].type).toBe('transmission_sync');
      expect(store.jobs[0].payload).toEqual({ trigger: 'scheduled' });
      expect(store.jobs[0].status).toBe('pending');
      expect(enqueued.job.queuedAt).toBe(new Date(store.jobs[0].created_at as Date).toISOString());
    });

    it('coalesces a second enqueue while one is outstanding', async () => {
      seedSyncJob({ status: 'processing' });

      const enqueued = await enqueue('transmission_sync', { trigger: 'scheduled' });

      expect(enqueued).toEqual({
        queued: false,
        job: { status: 'processing', queuedAt: createdAt.toISOString() },
      });
      expect(insertedJobs()).toHaveLength(0);
    });

    it('upgrades an outstanding pending scheduled job to manual', async () => {
      seedSyncJob({ id: 12 });

      const enqueued = await enqueue('transmission_sync', { trigger: 'manual' });

      expect(enqueued).toEqual({
        queued: false,
        job: { status: 'pending', queuedAt: createdAt.toISOString() },
      });
      expect(store.jobs[0].payload).toEqual({ trigger: 'manual' });
      const [update] = store.writes.filter((write) => write.op === 'update');
      expect(update.values).toEqual({ payload: { trigger: 'manual' }, updatedAt: expect.any(Date) });
      expect(renderSql(update.where)?.params).toEqual([12]);
      expect(insertedJobs()).toHaveLength(0);
    });

    it('does not upgrade an outstanding processing job', async () => {
      seedSyncJob({ id: 13, status: 'processing', payload: { trigger: 'scheduled' } });

      const enqueued = await enqueue('transmission_sync', { trigger: 'manual' });

      expect(enqueued).toEqual({
        queued: false,
        job: { status: 'processing', queuedAt: createdAt.toISOString() },
      });
      expect(store.writes).toHaveLength(0);
      expect(store.jobs[0].payload).toEqual({ trigger: 'scheduled' });
    });

    it('does not block a new enqueue once the previous run finished', async () => {
      seedSyncJob({ id: 14, status: 'completed', completed_at: createdAt });

      const enqueued = await enqueue('transmission_sync', { trigger: 'scheduled' });

      expect(enqueued.queued).toBe(true);
      expect(store.jobs).toHaveLength(2);
      expect(store.jobs[1].status).toBe('pending');
    });

    it('stores the trigger in the job payload', async () => {
      await enqueue('transmission_sync', { trigger: 'manual' });

      expect(store.jobs[0].payload).toEqual({ trigger: 'manual' });
    });

    it('reports queued:false when a concurrent enqueue wins the unique-index race', async () => {
      seedSyncJob({ id: 21 });
      // Postgres' unique-violation SQLSTATE for the singleton index.
      store.failNextWrite(Object.assign(new Error('duplicate key value'), { code: '23505' }));

      const enqueued = await enqueue('transmission_sync', { trigger: 'scheduled' });

      expect(enqueued).toEqual({
        queued: false,
        job: { status: 'pending', queuedAt: createdAt.toISOString() },
      });
      expect(store.selects).toHaveLength(1);
      expect(store.jobs).toHaveLength(1);
    });

    it('upgrades a race-winning scheduled job to manual', async () => {
      // The winner's insert lands between our find and our insert: our insert
      // dies with a unique violation, and we upgrade the winner to manual.
      store.raceNextInsert({
        type: 'transmission_sync',
        payload: { trigger: 'scheduled' },
        status: 'pending',
      });

      const enqueued = await enqueue('transmission_sync', { trigger: 'manual' });

      expect(enqueued).toEqual({
        queued: false,
        job: { status: 'pending', queuedAt: expect.any(String) },
      });
      expect(store.jobs).toHaveLength(1);
      expect(store.jobs[0].payload).toEqual({ trigger: 'manual' });
    });

    it('retries the insert when the race winner finished before it could be read', async () => {
      store.failNextWrite(Object.assign(new Error('duplicate key value'), { code: '23505' }));

      const enqueued = await enqueue('transmission_sync', { trigger: 'scheduled' });

      expect(enqueued).toEqual({
        queued: true,
        job: { status: 'pending', queuedAt: expect.any(String) },
      });
      // Two reads: the fast path found the slot free, then the loser re-checked.
      expect(store.selects).toHaveLength(2);
      expect(store.jobs).toHaveLength(1);
    });

    it('rethrows non-unique-violation create failures', async () => {
      const failure = new Error('connection refused');
      store.failNextWrite(failure);

      await expect(enqueue('transmission_sync', { trigger: 'scheduled' }))
        .rejects.toThrow('connection refused');
      expect(store.jobs).toHaveLength(0);
      expect(store.selects).toHaveLength(1);
    });
  });

  describe('notification types', () => {
    it('never coalesces request notifications', async () => {
      const payload = {
        id: 1,
        title: 'Movie',
        requested_by: 'kev',
        status: 'pending',
        requested_at: createdAt,
      };

      await enqueue('request_notification', payload);
      await enqueue('request_notification', payload);

      expect(store.jobs).toHaveLength(2);
      expect(store.jobs.every((job) => job.type === 'request_notification')).toBe(true);
    });
  });
});

describe('latestRun', () => {
  it('projects the newest run of a type to the seam shape', async () => {
    seedSyncJob({ id: 1, status: 'completed', completed_at: new Date('2026-09-05T10:00:00.000Z') });
    seedSyncJob({
      id: 2,
      status: 'failed',
      payload: { trigger: 'manual' },
      error: 'boom',
      created_at: new Date('2026-09-05T12:00:00.000Z'),
      completed_at: null,
    });

    await expect(latestRun('transmission_sync')).resolves.toEqual({
      status: 'failed',
      queuedAt: '2026-09-05T12:00:00.000Z',
      finishedAt: null,
      error: 'boom',
      trigger: 'manual',
      terminal: true,
    });
  });

  it('returns null when the type has never run', async () => {
    await expect(latestRun('transmission_sync')).resolves.toBeNull();
  });
});
