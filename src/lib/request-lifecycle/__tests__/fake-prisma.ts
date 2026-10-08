import { Prisma, PrismaClient } from '@/generated/prisma/client';

import { createRequestService } from '../repository';

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

export type FakePrisma = ReturnType<typeof makeFakePrisma>;

export const makeFakePrisma = () => {
  const rows: Row[] = [];
  let nextId = 1;

  const findFirst = jest.fn(async ({ where }: { where: { tmdb_id: number; season_number?: number | null } }) => {
    const wantSeason = where.season_number ?? null;
    return rows.find(
      (r) => r.tmdb_id === where.tmdb_id && (r.season_number ?? null) === wantSeason,
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

  const findMany = jest.fn(async ({ where }: { where: { status?: string; torrent_hash: { not: null } } }) => {
    const withHash = rows.filter((r) => r.torrent_hash !== null);
    if (where.status !== undefined) {
      return withHash
        .filter((r) => r.status === where.status)
        .map((r) => ({ id: r.id, torrent_hash: r.torrent_hash }));
    }
    return withHash.map((r) => ({ torrent_hash: r.torrent_hash }));
  });

  const del = jest.fn(async ({ where }: { where: { id: number } }) => {
    const idx = rows.findIndex((r) => r.id === where.id);
    if (idx === -1) throw new Error('Not found');
    const [removed] = rows.splice(idx, 1);
    return removed;
  });

  const txShape = () => ({
    request: { findFirst, findUnique, create, update, delete: del, findMany },
    job: { create: jest.fn().mockResolvedValue({ id: 1 }) },
  });

  // Emulate transaction atomicity: snapshot rows up front, restore them if the
  // transaction body throws, so aborted batches leave no partial writes.
  const $transaction = jest.fn(async (fn: (tx: ReturnType<typeof txShape>) => Promise<unknown>) => {
    const snapshot = rows.map((row) => ({ ...row }));
    try {
      return await fn(txShape());
    } catch (err) {
      rows.length = 0;
      rows.push(...snapshot);
      throw err;
    }
  });

  return {
    rows,
    request: { findFirst, findUnique, create, update, delete: del, findMany },
    job: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    $transaction,
    txShape,
  };
};

export const recordingEnqueueJob = () => {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const fn = jest.fn(async (_tx: Prisma.TransactionClient, type: string, payload: Prisma.InputJsonValue) => {
    calls.push({ type, payload });
  });
  return { fn, calls };
};

export const fixedNow = () => new Date('2026-06-15T12:00:00Z');

/**
 * Cast a fake prisma to the type the factory expects, keeping the call sites
 * concise. Tests stay honest about what they're stubbing because the fake
 * exposes the same surface (`rows`, `$transaction`, etc.) the real client has.
 */
export const asPrisma = (fake: FakePrisma): PrismaClient =>
  fake as unknown as PrismaClient;

export const makeService = (fake: FakePrisma) => {
  const { fn: enqueueJob } = recordingEnqueueJob();
  const service = createRequestService({
    prisma: asPrisma(fake),
    enqueueJob,
    now: fixedNow,
  });
  return { service, enqueueJob };
};
