import { createRequest, createTvRequests, linkTorrent, transitionToStatus } from '../request-service';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
    prisma: {
      request: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    job: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/lib/tmdb', () => ({
  getTMDBTVDetails: jest.fn(),
}));

jest.mock('../jobs', () => ({}));

describe('request-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('creates a movie request and enqueues a notification job', async () => {
      const mockRequest = {
        id: 1,
        title: 'Test Movie',
        tmdb_id: 123,
        season_number: null,
        media_type: 'movie',
        status: 'pending',
        requested_by: 'Alice',
        requested_at: new Date(),
        poster_path: null,
        release_date: '2024-01-01',
        overview: 'A movie',
        genre_ids: [28],
      };

      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          request: { create: jest.fn().mockResolvedValue(mockRequest) },
          job: { create: jest.fn().mockResolvedValue({ id: 1, type: 'request_notification' }) },
        };
        return await fn(tx);
      });

      const result = await createRequest({
        tmdbId: 123,
        title: 'Test Movie',
        posterPath: null,
        requestedBy: 'Alice',
        releaseDate: '2024-01-01',
        overview: 'A movie',
        genreIds: [28],
        mediaType: 'movie',
      });

      expect(result).toEqual(mockRequest);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('returns existing request without creating job for duplicate', async () => {
      const existing = { id: 5, title: 'Existing Movie', tmdb_id: 123, season_number: null };
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(existing);

      const result = await createRequest({
        tmdbId: 123,
        title: 'Existing Movie',
        posterPath: null,
        requestedBy: 'John Doe',
        mediaType: 'movie',
      });

      expect(result).toBe(existing);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws when title is missing', async () => {
      await expect(
        createRequest({ tmdbId: 1, title: '', posterPath: null, requestedBy: '', mediaType: 'movie' })
      ).rejects.toThrow('Title and requester name are required');
    });

    it('creates a TV request with season_number and enqueues job', async () => {
      const mockRequest = {
        id: 2,
        title: 'Test Show',
        tmdb_id: 456,
        season_number: 3,
        media_type: 'tv',
        status: 'pending',
        requested_by: 'Bob',
        requested_at: new Date(),
        poster_path: null,
        release_date: undefined,
        overview: undefined,
        genre_ids: [],
      };

      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          request: { create: jest.fn().mockResolvedValue(mockRequest) },
          job: { create: jest.fn().mockResolvedValue({ id: 2, type: 'request_notification' }) },
        };
        return await fn(tx);
      });

      const result = await createRequest({
        tmdbId: 456,
        title: 'Test Show',
        posterPath: null,
        requestedBy: 'Bob',
        mediaType: 'tv',
        seasonNumber: 3,
      });

      expect(result.media_type).toBe('tv');
      expect(result.season_number).toBe(3);
    });
  });

  describe('createTvRequests', () => {
    it('creates requests for all non-special seasons with single job', async () => {
      const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
      getTMDBTVDetails.mockResolvedValue({
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

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const created = [
          { id: 10, tmdb_id: 100, season_number: 1, media_type: 'tv', title: 'Best Show', status: 'pending' },
          { id: 11, tmdb_id: 100, season_number: 2, media_type: 'tv', title: 'Best Show', status: 'pending' },
        ];
        const tx = {
          request: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn()
              .mockResolvedValueOnce(created[0])
              .mockResolvedValueOnce(created[1]),
          },
          job: { create: jest.fn().mockResolvedValue({ id: 1, type: 'tv_series_request_notification' }) },
        };
        return await fn(tx);
      });

      const results = await createTvRequests(100, 'Alice');

      expect(results).toHaveLength(2);
    });

    it('skips already-requested seasons within the transaction', async () => {
      const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
      getTMDBTVDetails.mockResolvedValue({
        id: 100,
        name: 'Half Done',
        poster_path: null,
        first_air_date: null,
        seasons: [
          { season_number: 1, name: 'Season 1', episode_count: 10 },
          { season_number: 2, name: 'Season 2', episode_count: 8 },
        ],
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          request: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ id: 20, tmdb_id: 100, season_number: 1 })
              .mockResolvedValueOnce(null),
            create: jest.fn().mockResolvedValue({ id: 21, tmdb_id: 100, season_number: 2, media_type: 'tv', title: 'Half Done', status: 'pending' }),
          },
          job: { create: jest.fn().mockResolvedValue({ id: 1, type: 'tv_series_request_notification' }) },
        };
        return await fn(tx);
      });

      const results = await createTvRequests(100, 'Alice');
      expect(results).toHaveLength(2);
    });
  });

  describe('transitionToStatus', () => {
    it('nulls torrent_problem on transition', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'pending',
        torrent_problem: 'some problem',
      });
      (prisma.request.update as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'downloading',
        torrent_problem: null,
      });

      await transitionToStatus(1, 'downloading');

      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'downloading', torrent_problem: null },
      });
    });

    it('sets resolved_at on fulfill transition', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'downloading',
        torrent_problem: 'some problem',
      });
      (prisma.request.update as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'fulfilled',
        torrent_problem: null,
        resolved_at: new Date(),
      });

      await transitionToStatus(1, 'fulfilled');

      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'fulfilled', torrent_problem: null, resolved_at: expect.any(Date) },
      });
    });

    it('throws when request is not found', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(transitionToStatus(999, 'downloading')).rejects.toThrow('Request not found');
    });

    it('throws on invalid transition', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'fulfilled',
      });

      await expect(transitionToStatus(1, 'downloading')).rejects.toThrow(
        'Cannot transition from fulfilled to downloading'
      );
    });
  });

  describe('cancelRequest', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cancelRequest } = require('../request-service');

    it('deletes the request', async () => {
      (prisma.request.delete as jest.Mock).mockResolvedValue({ id: 1 });

      const result = await cancelRequest(1);

      expect(prisma.request.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('linkTorrent', () => {
    it('links a torrent to a pending request atomically (sets hash + transitions to downloading)', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          request: {
            findUnique: jest.fn().mockResolvedValue({
              id: 1,
              status: 'pending',
              torrent_problem: null,
            }),
            update: jest.fn().mockResolvedValue({
              id: 1,
              status: 'downloading',
              torrent_hash: 'abc123',
              torrent_problem: null,
            }),
          },
        };
        return await fn(tx);
      });

      const result = await linkTorrent(1, 'abc123');

      expect(result.status).toBe('downloading');
      expect(result.torrent_hash).toBe('abc123');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects if request is not pending', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          request: {
            findUnique: jest.fn().mockResolvedValue({
              id: 1,
              status: 'downloading',
            }),
          },
        };
        return await fn(tx);
      });

      await expect(linkTorrent(1, 'abc123')).rejects.toThrow(
        'Cannot transition from downloading to downloading'
      );
    });

    it('rejects if request is not found', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          request: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return await fn(tx);
      });

      await expect(linkTorrent(999, 'abc123')).rejects.toThrow('Request not found');
    });

    it('rejects if request already has a torrent_hash set', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          request: {
            findUnique: jest.fn().mockResolvedValue({
              id: 1,
              status: 'downloading',
              torrent_hash: 'existing-hash',
            }),
          },
        };
        return await fn(tx);
      });

      await expect(linkTorrent(1, 'abc123')).rejects.toThrow(
        'Cannot transition from downloading to downloading'
      );
    });
  });
});
