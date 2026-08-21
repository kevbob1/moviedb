import { Prisma } from '@/generated/prisma/client';

jest.mock('@/lib/tmdb', () => ({
  getTMDBTVDetails: jest.fn(),
}));

import { createRequestService } from '../repository';
import { InvalidTransitionError } from '../fsm';
import { getTMDBTVDetails } from '@/lib/tmdb';

type Row = {
  id: number;
  title: string;
  tmdb_id: number | null;
  season_number: number | null;
  poster_path: string | null;
  overview: string | null;
  release_date: string | null;
  genre_ids: number[];
  requested_at: Date;
  requested_by: string;
  status: string;
  media_type: string | null;
  torrent_hash: string | null;
  torrent_problem: string | null;
  resolved_at: Date | null;
  suggestion_hash: string | null;
  suggestion_score: number | null;
  suggestion_computed_at: Date | null;
};

const makeFakePrisma = () => {
  const rows: Row[] = [];
  let nextId = 1;

  const findFirst = jest.fn(async ({ where }: { where: { tmdb_id: number; season_number?: number | null } }) => {
    const wantSeason = where.season_number ?? null;
    return rows.find(
      (r) => r.tmdb_id === where.tmdb_id && (r.season_number ?? null) === wantSeason
    ) ?? null;
  });

  const findUnique = jest.fn(async ({ where }: { where: { id: number } }) => {
    return rows.find((r) => r.id === where.id) ?? null;
  });

  const create = jest.fn(async ({ data }: { data: Partial<Row> }) => {
    const row: Row = {
      id: nextId++,
      title: 'untitled',
      tmdb_id: null,
      season_number: null,
      poster_path: null,
      overview: null,
      release_date: null,
      genre_ids: [],
      requested_at: new Date('2026-01-01T00:00:00Z'),
      requested_by: 'nobody',
      status: 'pending',
      media_type: 'movie',
      torrent_hash: null,
      torrent_problem: null,
      resolved_at: null,
      suggestion_hash: null,
      suggestion_score: null,
      suggestion_computed_at: null,
      ...data,
    } as Row;
    rows.push(row);
    return row;
  });

  const update = jest.fn(async ({ where, data }: { where: { id: number }; data: Partial<Row> }) => {
    const row = rows.find((r) => r.id === where.id);
    if (!row) throw new Error('Not found');
    Object.assign(row, data);
    return row;
  });

  const del = jest.fn(async ({ where }: { where: { id: number } }) => {
    const idx = rows.findIndex((r) => r.id === where.id);
    if (idx === -1) throw new Error('Not found');
    const [removed] = rows.splice(idx, 1);
    return removed;
  });

  const txShape = () => ({
    request: { findFirst, findUnique, create, update, delete: del },
    job: { create: jest.fn().mockResolvedValue({ id: 1 }) },
  });

  const $transaction = jest.fn(async (fn: (tx: ReturnType<typeof txShape>) => Promise<unknown>) =>
    fn(txShape())
  );

  return {
    rows,
    request: { findFirst, findUnique, create, update, delete: del },
    job: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    $transaction,
    txShape,
  };
};

const recordingEnqueueJob = () => {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const fn = jest.fn(async (_tx: Prisma.TransactionClient, type: string, payload: Prisma.InputJsonValue) => {
    calls.push({ type, payload });
  });
  return { fn, calls };
};

const fixedNow = () => new Date('2026-06-15T12:00:00Z');

describe('request-lifecycle/service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('creates a request and enqueues a notification job atomically', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob, calls } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      const result = await service.createRequest({
        tmdbId: 123,
        title: 'Test Movie',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Movie');
      expect(result.status).toBe('pending');
      expect(fake.$transaction).toHaveBeenCalledTimes(1);
      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('request_notification');
    });

    it('returns the existing row without enqueuing when a duplicate exists', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob, calls } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await service.createRequest({
        tmdbId: 123,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });

      calls.length = 0;

      const result = await service.createRequest({
        tmdbId: 123,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Bob',
        mediaType: 'movie',
      });

      expect(result.id).toBe(1);
      expect(calls).toHaveLength(0);
      expect(fake.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws when title is missing', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await expect(
        service.createRequest({
          tmdbId: 1,
          title: '',
          posterPath: null,
          requestedBy: 'Alice',
          mediaType: 'movie',
        })
      ).rejects.toThrow('Title is required');
    });

    it('throws when requestedBy is missing', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await expect(
        service.createRequest({
          tmdbId: 1,
          title: 'Test',
          posterPath: null,
          requestedBy: '',
          mediaType: 'movie',
        })
      ).rejects.toThrow('Requester name is required');
    });

    it('creates TV season requests and enqueues a tv_series_request_notification job', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob, calls } = recordingEnqueueJob();

      (getTMDBTVDetails as jest.Mock).mockResolvedValue({
        id: 100,
        name: 'Best Show',
        first_air_date: '2022-01-01',
        poster_path: '/best.jpg',
        seasons: [
          { season_number: 0, name: 'Specials', episode_count: 5 },
          { season_number: 1, name: 'Season 1', episode_count: 10 },
          { season_number: 2, name: 'Season 2', episode_count: 8 },
        ],
      });

      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      const results = await service.createTvRequests(100, 'Alice');

      expect(results).toHaveLength(2);
      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('tv_series_request_notification');
    });
  });

  describe('transitionToStatus', () => {
    it('writes the status change and clears torrent_problem and suggestion fields', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      fake.rows[0].torrent_problem = 'some problem';
      fake.rows[0].suggestion_hash = 'old-hash';
      fake.rows[0].suggestion_score = 0.95;
      fake.rows[0].suggestion_computed_at = new Date('2026-01-01T00:00:00Z');

      await service.transitionToStatus(1, 'downloading');

      expect(fake.rows[0].status).toBe('downloading');
      expect(fake.rows[0].torrent_problem).toBeNull();
      expect(fake.rows[0].suggestion_hash).toBeNull();
      expect(fake.rows[0].suggestion_score).toBeNull();
      expect(fake.rows[0].suggestion_computed_at).toBeNull();
    });

    it('sets resolved_at on fulfill and clears suggestion fields', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.downloadRequest(1);
      fake.rows[0].suggestion_hash = 'old-hash';
      fake.rows[0].suggestion_score = 0.95;
      fake.rows[0].suggestion_computed_at = new Date('2026-01-01T00:00:00Z');

      const result = await service.fulfillRequest(1);

      expect(result.status).toBe('fulfilled');
      expect(fake.rows[0].resolved_at?.toISOString()).toBe('2026-06-15T12:00:00.000Z');
      expect(fake.rows[0].suggestion_hash).toBeNull();
      expect(fake.rows[0].suggestion_score).toBeNull();
      expect(fake.rows[0].suggestion_computed_at).toBeNull();
    });

    it('throws for an unknown request', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await expect(service.transitionToStatus(999, 'downloading')).rejects.toThrow('Request not found');
    });

    it('throws InvalidTransitionError on a disallowed transition', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.fulfillRequest(1);

      await expect(service.downloadRequest(1)).rejects.toBeInstanceOf(InvalidTransitionError);
    });
  });

  describe('linkTorrent', () => {
    it('transitions pending → downloading with hash set and clears suggestion fields', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      fake.rows[0].suggestion_hash = 'old-hash';
      fake.rows[0].suggestion_score = 0.95;
      fake.rows[0].suggestion_computed_at = new Date('2026-01-01T00:00:00Z');

      const result = await service.linkTorrent(1, 'abc123');

      expect(result.status).toBe('downloading');
      expect(fake.rows[0].torrent_hash).toBe('abc123');
      expect(fake.rows[0].suggestion_hash).toBeNull();
      expect(fake.rows[0].suggestion_score).toBeNull();
      expect(fake.rows[0].suggestion_computed_at).toBeNull();
    });

    it('rejects if request is not pending', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.downloadRequest(1);

      await expect(service.linkTorrent(1, 'abc123')).rejects.toBeInstanceOf(InvalidTransitionError);
    });
  });

  describe('cancelRequest', () => {
    it('deletes the row', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });

      await service.cancelRequest(1);

      expect(fake.rows).toHaveLength(0);
    });
  });

  describe('fulfillBySync', () => {
    it('writes status=fulfilled, torrent_problem=null, resolved_at=now, and clears suggestion fields', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.downloadRequest(1);
      fake.rows[0].torrent_problem = 'prior problem';
      fake.rows[0].suggestion_hash = 'old-hash';
      fake.rows[0].suggestion_score = 0.95;
      fake.rows[0].suggestion_computed_at = new Date('2026-01-01T00:00:00Z');

      const tx = fake.txShape();
      await service.fulfillBySync(1, tx as unknown as Prisma.TransactionClient);

      expect(fake.rows[0].status).toBe('fulfilled');
      expect(fake.rows[0].torrent_problem).toBeNull();
      expect(fake.rows[0].resolved_at?.toISOString()).toBe('2026-06-15T12:00:00.000Z');
      expect(fake.rows[0].suggestion_hash).toBeNull();
      expect(fake.rows[0].suggestion_score).toBeNull();
      expect(fake.rows[0].suggestion_computed_at).toBeNull();
    });
  });

  describe('flagTorrentProblem', () => {
    it('stamps torrent_problem only', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: fake as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob,
        now: fixedNow,
      });

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.downloadRequest(1);
      const tx = fake.txShape();

      await service.flagTorrentProblem(1, 'Transmission error: disk full', tx as unknown as Prisma.TransactionClient);

      expect(fake.rows[0].torrent_problem).toBe('Transmission error: disk full');
      expect(fake.rows[0].status).toBe('downloading');
      expect(fake.rows[0].resolved_at).toBeNull();
    });
  });
});