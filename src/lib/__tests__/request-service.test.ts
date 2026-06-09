import { createRequest, createTvRequests } from '../request-service';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
  prisma: {
    request: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../notifications', () => ({
  sendRequestNotification: jest.fn().mockResolvedValue(undefined),
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

describe('request-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('creates a movie request', async () => {
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock).mockResolvedValue({
        id: 1,
        title: 'Test Movie',
        tmdb_id: 123,
        season_number: null,
        media_type: 'movie',
        status: 'pending',
      });

      const result = await createRequest({
        tmdbId: 123,
        title: 'Test Movie',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });

      expect(result.media_type).toBe('movie');
      expect(result.season_number).toBeNull();
    });

    it('creates a TV season request', async () => {
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock).mockResolvedValue({
        id: 2,
        title: 'Test Show',
        tmdb_id: 456,
        season_number: 3,
        media_type: 'tv',
        status: 'pending',
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

    it('detects duplicate by tmdb_id + season_number', async () => {
      const existing = { id: 1, tmdb_id: 456, season_number: 3 };
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(existing);

      const result = await createRequest({
        tmdbId: 456,
        title: 'Test Show',
        posterPath: null,
        requestedBy: 'Bob',
        mediaType: 'tv',
        seasonNumber: 3,
      });

      expect(result).toBe(existing);
      expect(prisma.request.create).not.toHaveBeenCalled();
    });

    it('throws when title is missing', async () => {
      await expect(
        createRequest({ tmdbId: 1, title: '', posterPath: null, requestedBy: '', mediaType: 'movie' })
      ).rejects.toThrow('Title and requester name are required');
    });
  });

  describe('createTvRequests', () => {
    it('creates requests for all non-special seasons', async () => {
      const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
      getTMDBTVDetails.mockResolvedValue({
        id: 100,
        name: 'Best Show',
        seasons: [
          { season_number: 0, name: 'Specials', episode_count: 5 },
          { season_number: 1, name: 'Season 1', episode_count: 10 },
          { season_number: 2, name: 'Season 2', episode_count: 8 },
        ],
      });

      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock)
        .mockResolvedValueOnce({ id: 10, tmdb_id: 100, season_number: 1, media_type: 'tv' })
        .mockResolvedValueOnce({ id: 11, tmdb_id: 100, season_number: 2, media_type: 'tv' });

      const results = await createTvRequests(100, 'Alice');

      expect(results).toHaveLength(2);
      expect(results[0].season_number).toBe(1);
      expect(results[1].season_number).toBe(2);
      expect(prisma.request.create).toHaveBeenCalledTimes(2);
    });

    it('skips Season 0 (specials)', async () => {
      const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
      getTMDBTVDetails.mockResolvedValue({
        id: 100,
        name: 'Special Show',
        seasons: [
          { season_number: 0, name: 'Specials', episode_count: 1 },
          { season_number: 1, name: 'Season 1', episode_count: 10 },
        ],
      });

      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock).mockResolvedValue({
        id: 12, tmdb_id: 100, season_number: 1, media_type: 'tv',
      });

      const results = await createTvRequests(100, 'Alice');
      expect(results).toHaveLength(1);
      expect(results[0].season_number).toBe(1);
    });

    it('skips already-requested seasons', async () => {
      const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
      getTMDBTVDetails.mockResolvedValue({
        id: 100,
        name: 'Half Done Show',
        seasons: [
          { season_number: 1, name: 'Season 1', episode_count: 10 },
          { season_number: 2, name: 'Season 2', episode_count: 8 },
        ],
      });

      (prisma.request.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 20, tmdb_id: 100, season_number: 1 })
        .mockResolvedValueOnce(null);

      (prisma.request.create as jest.Mock).mockResolvedValue({
        id: 21, tmdb_id: 100, season_number: 2, media_type: 'tv',
      });

      const results = await createTvRequests(100, 'Alice');
      expect(results).toHaveLength(2);
      expect(prisma.request.create).toHaveBeenCalledTimes(1);
    });
  });
});
