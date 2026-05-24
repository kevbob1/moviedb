// src/app/actions/__tests__/request-actions.test.ts

import { createRequest, fulfillRequest } from '../request-actions';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma');

describe('request-actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).request = { create: jest.fn(), update: jest.fn() };
  });

  describe('createRequest', () => {
    it('creates a request and returns it', async () => {
      const mockRequest = {
        id: 1,
        title: 'Test Movie',
        tmdb_id: 123,
        poster_path: '/test.jpg',
        status: 'pending',
        media_type: 'movie',
        requested_at: new Date(),
        requested_by: 'Alice'
      };

      (prisma.request.create as jest.Mock).mockResolvedValue(mockRequest);

      const result = await createRequest(123, 'Test Movie', '/test.jpg', 'Alice');

      expect(result).toEqual(mockRequest);
      expect(prisma.request.create).toHaveBeenCalledWith({
        data: {
          tmdb_id: 123,
          title: 'Test Movie',
          poster_path: '/test.jpg',
          requested_by: 'Alice',
          status: 'pending',
          media_type: 'movie'
        }
      });
    });

    it('throws error on failure', async () => {
      (prisma.request.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(createRequest(123, 'Test', '/test.jpg', 'Alice')).rejects.toThrow();
    });
  });

  describe('fulfillRequest', () => {
    it('updates request status to fulfilled', async () => {
      const mockRequest = {
        id: 1,
        status: 'fulfilled'
      };

      (prisma.request.update as jest.Mock).mockResolvedValue(mockRequest);

      const result = await fulfillRequest(1);

      expect(result).toEqual(mockRequest);
      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'fulfilled' }
      });
    });
  });
});
