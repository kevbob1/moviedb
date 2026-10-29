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
  },
}));

jest.mock('@/lib/jobs', () => ({}));
jest.mock('@/lib/tmdb', () => ({}));
jest.mock('@/lib/import-flow', () => ({
  defaultImportFlow: { requestImport: jest.fn() },
}));

import { revalidatePath } from 'next/cache';

import { db } from '../../../../drizzle/db';
import { storeOf } from '../../../test-support/fake-drizzle';
import {
  cancelRequest,
  downloadRequest,
  fulfillRequest,
  linkTorrent,
} from '../request-actions';

const store = storeOf(db);

/** A full Request row in the snake_case shape the store and mapper use. */
const seedRequest = (overrides: Record<string, unknown> = {}) => {
  const row = {
    id: store.requests.length + 1,
    title: 'Test Movie',
    tmdb_id: 123,
    season_number: null,
    poster_path: '/path.jpg',
    overview: 'A movie',
    release_date: '2024-01-01',
    genre_ids: [28, 12],
    requested_by: 'John Doe',
    requested_at: new Date('2024-06-01T00:00:00Z'),
    status: 'pending',
    media_type: 'movie',
    torrent_hash: null,
    torrent_problem: null,
    resolved_at: null,
    suggestion_hash: null,
    suggestion_score: null,
    suggestion_computed_at: null,
    ...overrides,
  };
  store.requests.push(row);
  return row;
};

describe('request-actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.requests.length = 0;
    store.writes.length = 0;
  });

  describe('fulfillRequest', () => {
    it('updates status to fulfilled when valid', async () => {
      const row = seedRequest();

      await fulfillRequest(row.id);

      expect(row.status).toBe('fulfilled');
      expect(row.resolved_at).toEqual(expect.any(Date));
      expect(row.torrent_problem).toBeNull();
      expect(row.suggestion_hash).toBeNull();
      expect(row.suggestion_score).toBeNull();
      expect(row.suggestion_computed_at).toBeNull();
      expect(revalidatePath).toHaveBeenCalledWith('/requests');
    });

    it('throws if request not found', async () => {
      await expect(fulfillRequest(1)).rejects.toThrow('Request not found');
    });

    it('throws if transition is invalid', async () => {
      const row = seedRequest({ status: 'fulfilled' });

      await expect(fulfillRequest(row.id)).rejects.toThrow(
        'Cannot transition from fulfilled to fulfilled'
      );
      expect(row.status).toBe('fulfilled');
    });
  });

  describe('downloadRequest', () => {
    it('updates status to downloading when valid', async () => {
      const row = seedRequest();

      await downloadRequest(row.id);

      expect(row.status).toBe('downloading');
      expect(row.torrent_problem).toBeNull();
      expect(row.suggestion_hash).toBeNull();
      expect(revalidatePath).toHaveBeenCalledWith('/requests');
    });

    it('throws if transition is invalid', async () => {
      const row = seedRequest({ status: 'fulfilled' });

      await expect(downloadRequest(row.id)).rejects.toThrow(
        'Cannot transition from fulfilled to downloading'
      );
    });
  });

  describe('cancelRequest', () => {
    it('deletes the request and revalidates paths', async () => {
      const row = seedRequest();

      await cancelRequest(row.id);

      expect(store.requests).toHaveLength(0);
      expect(store.writes.filter((write) => write.op === 'update')).toHaveLength(0);
      expect(revalidatePath).toHaveBeenCalledWith('/requests');
      expect(revalidatePath).toHaveBeenCalledWith('/needs-match');
    });

    it('is a no-op when the row is already gone', async () => {
      await expect(cancelRequest(999)).resolves.toBeUndefined();
      expect(revalidatePath).toHaveBeenCalledWith('/requests');
    });
  });

  describe('linkTorrent', () => {
    it('links a torrent to a pending request and revalidates', async () => {
      const row = seedRequest();

      const result = await linkTorrent(row.id, 'abc123');

      expect(result.status).toBe('downloading');
      expect(result.torrent_hash).toBe('abc123');
      expect(row.torrent_hash).toBe('abc123');
      expect(store.transactions).toBe(1);
      expect(revalidatePath).toHaveBeenCalledWith('/needs-match');
    });

    it('rejects if request is not pending', async () => {
      const row = seedRequest({ status: 'fulfilled' });

      await expect(linkTorrent(row.id, 'abc123')).rejects.toThrow(
        'Cannot transition from fulfilled to downloading'
      );
    });
  });
});
