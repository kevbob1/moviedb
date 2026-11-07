import type { Db } from '../../../../drizzle/db';
import { createRequestIntake } from '../lifecycle';
import { applyTransition } from '../lifecycle';
import {
  createRequestJobSyncReads,
  createRequestReads,
} from '../queries';
import { makeFakeDrizzle } from '../../../test-support/fake-drizzle';

const pendingRow = {
  id: 1,
  title: 'Dune',
  tmdb_id: 1,
  season_number: null,
  poster_path: null,
  overview: null,
  release_date: null,
  genre_ids: [],
  requested_by: 'alice',
  requested_at: new Date('2026-01-01T00:00:00Z'),
  status: 'pending',
  media_type: 'movie',
  torrent_hash: null,
  torrent_problem: null,
  resolved_at: null,
  suggestion_hash: null,
  suggestion_score: null,
  suggestion_computed_at: null,
};

describe('applyTransition coverage edges', () => {
  it('reports a row that disappears between read and write as not found', async () => {
    const client = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [pendingRow],
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => [],
          }),
        }),
      }),
    } as unknown as Parameters<typeof applyTransition>[0];

    await expect(
      applyTransition(client, 1, 'fulfilled', () => new Date('2026-01-02T00:00:00Z')),
    ).resolves.toEqual({ ok: false, skipped: 'not_found' });
  });
});

describe('createRequestIntake coverage edges', () => {
  const emptyReads = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
  };

  function dbWithInsertResult(rows: unknown[]): Db {
    const tx = {
      ...emptyReads,
      insert: () => ({
        values: () => ({
          returning: async () => rows,
        }),
      }),
    };
    return {
      ...emptyReads,
      insert: tx.insert,
      transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
    } as unknown as Db;
  }

  it('throws when the request insert returns no row', async () => {
    const intake = createRequestIntake({
      db: dbWithInsertResult([]),
      enqueueJob: jest.fn(),
    });

    await expect(
      intake.createRequest({
        tmdbId: 1,
        title: 'Dune',
        posterPath: null,
        requestedBy: 'alice',
        mediaType: 'movie',
      } as never),
    ).rejects.toThrow('Request insert returned no row');
  });

  it('rejects an invalid requestedBy before reading TMDB', async () => {
    const tmdb = {
      tvDetails: jest.fn(),
    } as never;
    const intake = createRequestIntake({
      db: dbWithInsertResult([]),
      enqueueJob: jest.fn(),
      tmdb,
    });

    await expect(intake.createTvRequests(2, '')).rejects.toThrow();
    expect((tmdb as { tvDetails: jest.Mock }).tvDetails).not.toHaveBeenCalled();
  });

  it('throws when a TV season insert returns no row', async () => {
    const db = dbWithInsertResult([]);
    const intake = createRequestIntake({
      db,
      enqueueJob: jest.fn(),
      tmdb: {
        tvDetails: jest.fn().mockResolvedValue({
          id: 2,
          name: 'A Show',
          poster_path: null,
          first_air_date: '2023-01-01',
          seasons: [
            { season_number: 0, name: 'Specials', episode_count: 1, poster_path: null },
            { season_number: 1, name: 'Season 1', episode_count: 8, poster_path: null },
          ],
        }),
      } as never,
    });

    await expect(intake.createTvRequests(2, 'alice')).rejects.toThrow(
      'Request insert returned no row',
    );
  });
});

describe('request read coverage edges', () => {
  it('drops null torrent hashes from both hash reads', async () => {
    const fake = makeFakeDrizzle({
      rows: [{ id: 1, torrent_hash: null }, { id: 2, torrent_hash: 'hash' }],
    });
    const reads = createRequestJobSyncReads({
      db: fake.db,
      now: () => new Date('2026-01-01T00:00:00Z'),
    });

    await expect(reads.claimedTorrentHashes()).resolves.toEqual(['hash']);
    await expect(reads.downloadingRequestsWithHashes()).resolves.toEqual([
      { id: 2, torrent_hash: 'hash' },
    ]);
  });

  it('defaults missing count rows to zero', async () => {
    const chain: Record<string, unknown> = {};
    for (const method of ['from', 'where', 'orderBy', 'limit', 'offset']) {
      chain[method] = () => chain;
    }
    chain.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve([]).then(resolve);
    const db = { select: () => chain } as unknown as Db;

    const reads = createRequestReads({ db });
    await expect(reads.listRequests({ page: 1 })).resolves.toEqual({
      rows: [],
      total: 0,
      totalPages: 0,
    });

    const jobReads = createRequestJobSyncReads({
      db,
      now: () => new Date('2026-01-01T00:00:00Z'),
    });
    await expect(jobReads.queueStats()).resolves.toEqual({
      needsMatch: 0,
      needsAttention: 0,
    });
  });
});
