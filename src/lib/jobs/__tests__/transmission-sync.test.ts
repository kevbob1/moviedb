import { prisma } from '@/lib/prisma';
import { InMemoryTransmissionAdapter } from '@/lib/transmission/adapter';
import { createTransmissionSyncHandler, enqueueTransmissionSync } from '../transmission-sync';

const mockTx = { request: { update: jest.fn().mockResolvedValue({}) } };

jest.mock('@/lib/prisma', () => ({
  prisma: {
    request: {
      findMany: jest.fn(),
    },
    job: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockTx.request.update.mockClear();
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx),
  );
});

describe('transmission_sync handler', () => {
  describe('completion happy path', () => {
    it('flips downloading → fulfilled when isFinished is true', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash1', name: 'Movie A', percentDone: 0, status: 6, isFinished: true },
        ],
      });

      (prisma.request.findMany as jest.Mock).mockResolvedValue([
        { id: 1, torrent_hash: 'hash1' },
      ]);

      const handler = createTransmissionSyncHandler({ adapter });
      await handler.handle({});

      expect(mockTx.request.update).toHaveBeenCalledWith({
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
    });

    it('does NOT fulfill while torrent is still downloading (status 4)', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash2', name: 'Movie B', percentDone: 0.5, status: 4 },
        ],
      });

      (prisma.request.findMany as jest.Mock).mockResolvedValue([
        { id: 2, torrent_hash: 'hash2' },
      ]);

      const handler = createTransmissionSyncHandler({ adapter });
      await handler.handle({});

      expect(mockTx.request.update).not.toHaveBeenCalled();
    });

    it('flips downloading → fulfilled when status is 6 (seeding)', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash2b', name: 'Movie B2', percentDone: 1, status: 6 },
        ],
      });

      (prisma.request.findMany as jest.Mock).mockResolvedValue([
        { id: 22, torrent_hash: 'hash2b' },
      ]);

      const handler = createTransmissionSyncHandler({ adapter });
      await handler.handle({});

      expect(mockTx.request.update).toHaveBeenCalledWith({
        where: { id: 22 },
        data: {
          status: 'fulfilled',
          torrent_problem: null,
          resolved_at: expect.any(Date),
          suggestion_hash: null,
          suggestion_score: null,
          suggestion_computed_at: null,
        },
      });
    });
  });

  describe('error stamp (no transition)', () => {
    it('stamps torrent_problem and does not mutate status when torrent has an error', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash3', name: 'Movie C', percentDone: 0.5, status: 4, error: 'disk full' },
        ],
      });

      (prisma.request.findMany as jest.Mock).mockResolvedValue([
        { id: 3, torrent_hash: 'hash3' },
      ]);

      const handler = createTransmissionSyncHandler({ adapter });
      await handler.handle({});

      expect(mockTx.request.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { torrent_problem: 'Transmission error: disk full' },
      });
    });
  });

  describe('disappearance stamp (no transition)', () => {
    it('stamps torrent_problem and does not mutate status when hash missing from response', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'other-hash', name: 'Other', percentDone: 0, status: 4 },
        ],
      });

      (prisma.request.findMany as jest.Mock).mockResolvedValue([
        { id: 4, torrent_hash: 'missing-hash' },
      ]);

      const handler = createTransmissionSyncHandler({ adapter });
      await handler.handle({});

      expect(mockTx.request.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { torrent_problem: 'Torrent not found in Transmission' },
      });
    });
  });

  describe('no-op when idle', () => {
    it('does nothing when no downloading requests with torrent_hash exist', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash5', name: 'Movie E', percentDone: 1, status: 6, isFinished: true },
        ],
      });

      (prisma.request.findMany as jest.Mock).mockResolvedValue([]);

      const handler = createTransmissionSyncHandler({ adapter });
      await handler.handle({});

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

describe('enqueueTransmissionSync', () => {
  it('creates a transmission_sync job when none is outstanding', async () => {
    (prisma.job.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.job.create as jest.Mock).mockResolvedValue({ id: 1 });

    const enqueued = await enqueueTransmissionSync();

    expect(enqueued).toBe(true);
    expect(prisma.job.findFirst).toHaveBeenCalledWith({
      where: { type: 'transmission_sync', status: { in: ['pending', 'processing'] } },
      select: { id: true },
    });
    expect(prisma.job.create).toHaveBeenCalledWith({
      data: { type: 'transmission_sync', payload: {} },
    });
  });

  it('skips when a sync job is already pending or processing', async () => {
    (prisma.job.findFirst as jest.Mock).mockResolvedValue({ id: 9 });

    const enqueued = await enqueueTransmissionSync();

    expect(enqueued).toBe(false);
    expect(prisma.job.create).not.toHaveBeenCalled();
  });
});
