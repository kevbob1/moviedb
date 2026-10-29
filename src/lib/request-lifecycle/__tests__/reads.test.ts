import { createRequestService } from '../repository';

import { makeFakeDrizzle, renderSql } from '../../../test-support/fake-drizzle';
import { fixedNow } from './fake-prisma';

type PrismaLike = Parameters<typeof createRequestService>[0]['prisma'];

/**
 * Reads are on Drizzle now, so these tests inject a fake `db`; Prisma is only
 * present because the composed service still requires a write client.
 */
const makeService = (fake: ReturnType<typeof makeFakeDrizzle>) =>
  createRequestService({
    prisma: {} as unknown as PrismaLike,
    db: fake.db,
    enqueueJob: jest.fn(),
    now: fixedNow,
  });

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

    it('reads the active queue (resolved excluded) with limit/offset and page arithmetic', async () => {
      const fake = makeFakeDrizzle({ rows: [row], count: 13 });
      const service = makeService(fake);

      const result = await service.listRequests({ page: 2 });

      const [rowsQuery, countQuery] = fake.selects;
      expect(fake.selects).toHaveLength(2);
      expect(rowsQuery.kind).toBe('rows');
      // status <> 'fulfilled'
      expect(renderSql(rowsQuery.where)?.params).toEqual(['fulfilled']);
      expect(renderSql(rowsQuery.where)?.sql).toContain('"requests"."status" <> $1');
      expect(renderSql(rowsQuery.orderBy)?.sql).toBe('"requests"."requested_at" desc');
      expect(rowsQuery.limit).toBe(12);
      expect(rowsQuery.offset).toBe(12);

      expect(countQuery.kind).toBe('count');
      expect(renderSql(countQuery.where)).toEqual(renderSql(rowsQuery.where));

      expect(result.rows).toHaveLength(1);
      expect(result.total).toBe(13);
      expect(result.totalPages).toBe(2);
    });

    it('drops the status predicate when includeResolved is true', async () => {
      const fake = makeFakeDrizzle({ rows: [], count: 0 });
      const service = makeService(fake);

      await service.listRequests({ page: 1, includeResolved: true });

      const [rowsQuery] = fake.selects;
      expect(rowsQuery.where).toBeUndefined();
      expect(rowsQuery.limit).toBe(12);
      expect(rowsQuery.offset).toBe(0);
    });

    it('projects raw rows into the operator-facing Request model', async () => {
      const fake = makeFakeDrizzle({ rows: [row], count: 1 });
      const service = makeService(fake);

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
      const fake = makeFakeDrizzle({ rows: [row] });
      const service = makeService(fake);

      const result = await service.requestById(7);

      const [query] = fake.selects;
      expect(renderSql(query.where)).toEqual({
        sql: '"requests"."id" = $1',
        params: [7],
      });
      expect(query.limit).toBe(1);
      expect(result?.id).toBe(1);
      expect(result?.status).toBe('pending');
      expect(result?.tmdb_id).toBeUndefined();
      expect(result?.requested_at).toBe('2023-06-01T00:00:00.000Z');
    });

    it('returns null when no row exists', async () => {
      const fake = makeFakeDrizzle({ rows: [] });
      const service = makeService(fake);

      expect(await service.requestById(999)).toBeNull();
    });
  });
});
