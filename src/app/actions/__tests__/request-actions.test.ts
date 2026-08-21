// src/app/actions/__tests__/request-actions.test.ts
import { createRequest, fulfillRequest, cancelRequest, downloadRequest, linkTorrent } from '../request-actions';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

jest.mock('@/lib/prisma');
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock('@/lib/jobs', () => ({}));
jest.mock('@/lib/tmdb', () => ({
  getTMDBTVDetails: jest.fn(),
}));

const fullRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Test Movie',
  tmdb_id: 123,
  poster_path: '/path.jpg',
  overview: 'A movie',
  release_date: '2024-01-01',
  genre_ids: [28, 12],
  requested_by: 'John Doe',
  requested_at: new Date('2024-06-01T00:00:00Z'),
  status: 'pending',
  season_number: null,
  media_type: 'movie',
  torrent_hash: null,
  torrent_problem: null,
  resolved_at: null,
  ...overrides,
});

describe('request-actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (prisma as any).request = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };
    (prisma as any).job = {
      create: jest.fn(),
    };
    (prisma as unknown as Record<string, unknown>).$transaction = jest.fn().mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const prismaAny = prisma as unknown as Record<string, unknown>;
        const tx = {
          request: { ...(prismaAny.request as Record<string, unknown>) },
          job: { ...(prismaAny.job as Record<string, unknown>) },
        };
        return await fn(tx);
      }
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

  describe('createRequest', () => {
    it('creates a request with pending status and extra fields', async () => {
      const mockRow = fullRow();
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock).mockResolvedValue(mockRow);

      const result = await createRequest(123, 'Test Movie', '/path.jpg', 'John Doe', '2024-01-01', 'A movie', [28, 12], 'movie');

      expect(prisma.request.findFirst).toHaveBeenCalledWith({ where: { tmdb_id: 123, season_number: null } });
      expect(prisma.request.create).toHaveBeenCalledWith({
        data: {
          tmdb_id: 123,
          title: 'Test Movie',
          poster_path: '/path.jpg',
          requested_by: 'John Doe',
          status: 'pending',
          media_type: 'movie',
          release_date: '2024-01-01',
          overview: 'A movie',
          genre_ids: [28, 12],
          season_number: null,
        },
      });
      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Movie');
      expect(result.status).toBe('pending');
    });

    it('returns existing request if tmdb_id already exists', async () => {
      const existing = fullRow({ id: 5, title: 'Existing Movie' });
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(existing);

      const result = await createRequest(123, 'Existing Movie', '/path.jpg', 'John Doe');

      expect(result.id).toBe(5);
      expect(prisma.request.create).not.toHaveBeenCalled();
    });

    it('throws if title is empty', async () => {
      await expect(createRequest(123, '', '/path.jpg', 'John Doe')).rejects.toThrow(
        'Title is required'
      );
    });

    it('throws if requestedBy is empty', async () => {
      await expect(createRequest(123, 'Test', '/path.jpg', '')).rejects.toThrow(
        'Requester name is required'
      );
    });

    it('creates a TV request with season_number', async () => {
      const mockRow = fullRow({ id: 2, title: 'Test Show', season_number: 3, media_type: 'tv' });
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock).mockResolvedValue(mockRow);

      const result = await createRequest(456, 'Test Show', '/path.jpg', 'Alice', undefined, undefined, undefined, 'tv', 3);

      expect(prisma.request.findFirst).toHaveBeenCalledWith({ where: { tmdb_id: 456, season_number: 3 } });
      expect(result.media_type).toBe('tv');
      expect(result.season_number).toBe(3);
    });
  });

  describe('fulfillRequest', () => {
    it('updates status to fulfilled when valid', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue(fullRow({ status: 'pending' }));
      (prisma.request.update as jest.Mock).mockResolvedValue(fullRow({ status: 'fulfilled' }));

      await fulfillRequest(1);

      expect(prisma.request.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'fulfilled',
          torrent_problem: null,
          resolved_at: expect.any(Date),
          suggestion_hash: null,
          suggestion_score: null,
          suggestion_computed_at: null,
        },
      });
      expect(revalidatePath).toHaveBeenCalledWith('/requests');
    });

    it('throws if request not found', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(fulfillRequest(1)).rejects.toThrow('Request not found');
    });

    it('throws if transition is invalid', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue(fullRow({ status: 'fulfilled' }));

      await expect(fulfillRequest(1)).rejects.toThrow(
        'Cannot transition from fulfilled to fulfilled'
      );
    });
  });

  describe('downloadRequest', () => {
    it('updates status to downloading when valid', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue(fullRow({ status: 'pending' }));
      (prisma.request.update as jest.Mock).mockResolvedValue(fullRow({ status: 'downloading' }));

      await downloadRequest(1);

      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'downloading',
          torrent_problem: null,
          suggestion_hash: null,
          suggestion_score: null,
          suggestion_computed_at: null,
        },
      });
      expect(revalidatePath).toHaveBeenCalledWith('/requests');
    });

    it('throws if transition is invalid', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue(fullRow({ status: 'fulfilled' }));

      await expect(downloadRequest(1)).rejects.toThrow(
        'Cannot transition from fulfilled to downloading'
      );
    });
  });

  describe('cancelRequest', () => {
    it('deletes the request and revalidates paths', async () => {
      (prisma.request.delete as jest.Mock).mockResolvedValue(fullRow());

      await cancelRequest(1);

      expect(prisma.request.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prisma.request.findUnique).not.toHaveBeenCalled();
      expect(prisma.request.update).not.toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith('/requests');
      expect(revalidatePath).toHaveBeenCalledWith('/needs-match');
    });
  });

  describe('linkTorrent', () => {
    it('links a torrent to a pending request and revalidates', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          request: {
            findUnique: jest.fn().mockResolvedValue(fullRow({ status: 'pending' })),
            update: jest.fn().mockResolvedValue(fullRow({ status: 'downloading', torrent_hash: 'abc123' })),
          },
        };
        return await fn(tx);
      });

      const result = await linkTorrent(1, 'abc123');

      expect(result.status).toBe('downloading');
      expect(result.torrent_hash).toBe('abc123');
      expect(revalidatePath).toHaveBeenCalledWith('/needs-match');
    });

    it('rejects if request is not pending', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          request: {
            findUnique: jest.fn().mockResolvedValue(fullRow({ status: 'fulfilled' })),
          },
        };
        return await fn(tx);
      });

      await expect(linkTorrent(1, 'abc123')).rejects.toThrow(
        'Cannot transition from fulfilled to downloading'
      );
    });
  });
});