// src/app/actions/__tests__/request-actions.test.ts
import { createRequest, fulfillRequest, cancelRequest, downloadRequest } from '../request-actions';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { sendRequestNotification } from '@/lib/notifications';

jest.mock('@/lib/prisma');
jest.mock('@/lib/notifications', () => ({
  sendRequestNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('request-actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prisma.request doesn't exist in types, need to mock it
    (prisma as any).request = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };
  });

  describe('createRequest', () => {
    it('creates a request with pending status and extra fields', async () => {
      const mockRequest = { id: 1, title: 'Test Movie', status: 'pending' };
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock).mockResolvedValue(mockRequest);

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
      expect(sendRequestNotification).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockRequest);
    });

    it('returns existing request if tmdb_id already exists', async () => {
      const existingRequest = { id: 5, title: 'Existing Movie', tmdb_id: 123, status: 'pending' };
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(existingRequest);

      const result = await createRequest(123, 'Existing Movie', '/path.jpg', 'John Doe');

      expect(result).toEqual(existingRequest);
      expect(prisma.request.create).not.toHaveBeenCalled();
      expect(sendRequestNotification).not.toHaveBeenCalled();
    });

    it('throws if title is empty', async () => {
      await expect(createRequest(123, '', '/path.jpg', 'John Doe')).rejects.toThrow(
        'Title and requester name are required'
      );
    });

    it('creates a TV request with season_number', async () => {
      const mockRequest = { id: 2, title: 'Test Show', status: 'pending', season_number: 3, media_type: 'tv' };
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock).mockResolvedValue(mockRequest);

      const result = await createRequest(456, 'Test Show', '/path.jpg', 'Alice', undefined, undefined, undefined, 'tv', 3);

      expect(prisma.request.findFirst).toHaveBeenCalledWith({ where: { tmdb_id: 456, season_number: 3 } });
      expect(result).toEqual(mockRequest);
    });
  });

  describe('fulfillRequest', () => {
    it('updates status to fulfilled when valid', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'pending',
      });
      (prisma.request.update as jest.Mock).mockResolvedValue({ id: 1, status: 'fulfilled' });

      await fulfillRequest(1);

      expect(prisma.request.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'fulfilled' },
      });
      expect(revalidatePath).toHaveBeenCalledWith('/requests');
    });

    it('throws if request not found', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(fulfillRequest(1)).rejects.toThrow('Request not found');
    });

    it('throws if transition is invalid', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'fulfilled',
      });

      await expect(fulfillRequest(1)).rejects.toThrow(
        'Cannot transition from fulfilled to fulfilled'
      );
    });
  });

  describe('downloadRequest', () => {
    it('updates status to downloading when valid', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'pending',
      });
      (prisma.request.update as jest.Mock).mockResolvedValue({ id: 1, status: 'downloading' });

      await downloadRequest(1);

      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'downloading' },
      });
      expect(revalidatePath).toHaveBeenCalledWith('/requests');
    });

    it('throws if transition is invalid', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'fulfilled',
      });

      await expect(downloadRequest(1)).rejects.toThrow(
        'Cannot transition from fulfilled to downloading'
      );
    });
  });

  describe('cancelRequest', () => {
    it('sets status to canceled instead of deleting', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'pending',
      });
      (prisma.request.update as jest.Mock).mockResolvedValue({ id: 1, status: 'canceled' });
      (prisma.request.delete as jest.Mock).mockResolvedValue({});

      await cancelRequest(1);

      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'canceled' },
      });
      expect(prisma.request.delete).not.toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith('/requests');
    });

    it('throws if cannot cancel current status', async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'fulfilled',
      });

      await expect(cancelRequest(1)).rejects.toThrow(
        'Cannot transition from fulfilled to canceled'
      );
    });
  });
});
