import { createRequestService } from '../repository';

import { fixedNow } from './fake-prisma';

type PrismaLike = Parameters<typeof createRequestService>[0]['prisma'];

describe('request-lifecycle/reads', () => {
  describe('listRequests', () => {
    const row = {
      id: 1,
      title: 'Test Movie',
      tmdb_id: 123,
      season_number: null,
      poster_path: '/test.jpg',
      overview: 'A test movie',
      release_date: '2023-01-01',
      genre_ids: [28],
      requested_by: 'Alice',
      requested_at: new Date('2023-06-01T00:00:00Z'),
      status: 'pending',
      media_type: 'movie',
      torrent_hash: null,
      torrent_problem: null,
      resolved_at: null,
      suggestion_hash: null,
      suggestion_score: null,
      suggestion_computed_at: null,
    };

    const makeService = (findMany: jest.Mock, count: jest.Mock) =>
      createRequestService({
        prisma: { request: { findMany, count } } as unknown as PrismaLike,
        enqueueJob: jest.fn(),
        now: fixedNow,
      });

    it('reads the active queue (resolved excluded) with skip/take and page arithmetic', async () => {
      const findMany = jest.fn().mockResolvedValue([row]);
      const count = jest.fn().mockResolvedValue(13);
      const service = makeService(findMany, count);

      const result = await service.listRequests({ page: 2 });

      expect(findMany).toHaveBeenCalledWith({
        where: { status: { notIn: ['fulfilled'] } },
        orderBy: { requested_at: 'desc' },
        skip: 12,
        take: 12,
      });
      expect(count).toHaveBeenCalledWith({
        where: { status: { notIn: ['fulfilled'] } },
      });
      expect(result.total).toBe(13);
      expect(result.totalPages).toBe(2);
    });

    it('drops the status predicate when includeResolved is true', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const count = jest.fn().mockResolvedValue(0);
      const service = makeService(findMany, count);

      await service.listRequests({ page: 1, includeResolved: true });

      expect(findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { requested_at: 'desc' },
        skip: 0,
        take: 12,
      });
    });

    it('projects raw rows into the operator-facing Request model', async () => {
      const findMany = jest.fn().mockResolvedValue([row]);
      const count = jest.fn().mockResolvedValue(1);
      const service = makeService(findMany, count);

      const result = await service.listRequests({ page: 1 });

      expect(result.rows).toEqual([
        {
          ...row,
          tmdb_id: 123,
          season_number: undefined,
          poster_path: '/test.jpg',
          overview: 'A test movie',
          release_date: '2023-01-01',
          requested_at: '2023-06-01T00:00:00.000Z',
          status: 'pending',
          media_type: 'movie',
          torrent_hash: null,
          torrent_problem: undefined,
          resolved_at: null,
          suggestion_hash: undefined,
          suggestion_score: undefined,
          suggestion_computed_at: undefined,
        },
      ]);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('requestById', () => {
    const row = {
      id: 1,
      title: 'Test Movie',
      tmdb_id: null,
      season_number: null,
      poster_path: null,
      overview: null,
      release_date: null,
      genre_ids: [],
      requested_by: 'Alice',
      requested_at: new Date('2023-06-01T00:00:00Z'),
      status: 'pending',
      media_type: 'movie',
      torrent_hash: null,
      torrent_problem: null,
      resolved_at: null,
      suggestion_hash: null,
      suggestion_score: null,
      suggestion_computed_at: null,
    };

    it('returns the projected request when the row exists', async () => {
      const findUnique = jest.fn().mockResolvedValue(row);
      const service = createRequestService({
        prisma: { request: { findUnique } } as unknown as PrismaLike,
        enqueueJob: jest.fn(),
        now: fixedNow,
      });

      const result = await service.requestById(7);

      expect(findUnique).toHaveBeenCalledWith({ where: { id: 7 } });
      expect(result?.id).toBe(1);
      expect(result?.status).toBe('pending');
      expect(result?.tmdb_id).toBeUndefined();
      expect(result?.requested_at).toBe('2023-06-01T00:00:00.000Z');
    });

    it('returns null when no row exists', async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const service = createRequestService({
        prisma: { request: { findUnique } } as unknown as PrismaLike,
        enqueueJob: jest.fn(),
        now: fixedNow,
      });

      expect(await service.requestById(999)).toBeNull();
    });
  });
});