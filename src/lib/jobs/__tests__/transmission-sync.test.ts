import { prisma } from '@/lib/prisma';
import { InMemoryTransmissionAdapter } from '@/lib/transmission/adapter';
import { createTransmissionSyncHandler, enqueueTransmissionSync, runTransmissionSync } from '../transmission-sync';

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
  (prisma.request.findMany as jest.Mock).mockResolvedValue([]);
});

describe('transmission_sync handler', () => {
  describe('completion happy path', () => {
    it('flips downloading → fulfilled when isFinished is true', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash1', name: 'Movie A', percentDone: 0, status: 6, isFinished: true },
        ],
      });

      (prisma.request.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { id: 1, torrent_hash: 'hash1' },
        ])
        .mockResolvedValueOnce([]);

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

      (prisma.request.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { id: 2, torrent_hash: 'hash2' },
        ])
        .mockResolvedValueOnce([]);

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

      (prisma.request.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { id: 22, torrent_hash: 'hash2b' },
        ])
        .mockResolvedValueOnce([]);

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

      (prisma.request.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { id: 3, torrent_hash: 'hash3' },
        ])
        .mockResolvedValueOnce([]);

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

      (prisma.request.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { id: 4, torrent_hash: 'missing-hash' },
        ])
        .mockResolvedValueOnce([]);

      const handler = createTransmissionSyncHandler({ adapter });
      await handler.handle({});

      expect(mockTx.request.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { torrent_problem: 'Torrent not found in Transmission' },
      });
    });
  });

  describe('no-op when idle', () => {
    it('does nothing when no downloading or pending requests exist', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash5', name: 'Movie E', percentDone: 1, status: 6, isFinished: true },
        ],
      });

      const handler = createTransmissionSyncHandler({ adapter });
      await handler.handle({});

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('suggestion computation', () => {
    it('writes suggestion columns for a pending request with a matching torrent', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS', percentDone: 1, status: 6 },
        ],
      });

      (prisma.request.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 10,
            title: 'Dune',
            media_type: 'movie',
            release_date: '2021-10-22',
            season_number: null,
          },
        ]);

      const handler = createTransmissionSyncHandler({ adapter });
      await handler.handle({});

      expect(mockTx.request.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          suggestion_hash: 'h1',
          suggestion_score: expect.any(Number),
          suggestion_computed_at: expect.any(Date),
        },
      });
    });

    it('clears suggestion columns when no eligible match exists', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'h1', name: 'Some.Unrelated.Show.S02.COMPLETE.1080p.WEB-DL.x264-GROUP', percentDone: 1, status: 6 },
        ],
      });

      (prisma.request.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 11,
            title: 'Dune',
            media_type: 'movie',
            release_date: '2021-10-22',
            season_number: null,
          },
        ]);

      const handler = createTransmissionSyncHandler({ adapter });
      await handler.handle({});

      expect(mockTx.request.update).toHaveBeenCalledWith({
        where: { id: 11 },
        data: {
          suggestion_hash: null,
          suggestion_score: null,
          suggestion_computed_at: expect.any(Date),
        },
      });
    });

    it('uses contained filenames when the torrent name is not descriptive', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          {
            hash: 'h1',
            name: 'folder',
            percentDone: 1,
            status: 6,
            files: ['Dune.2021.1080p.BluRay.x264-SWEETNESS.mkv'],
          },
        ],
      });

      (prisma.request.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 12,
            title: 'Dune',
            media_type: 'movie',
            release_date: '2021-10-22',
            season_number: null,
          },
        ]);

      const handler = createTransmissionSyncHandler({ adapter });
      await handler.handle({});

      expect(mockTx.request.update).toHaveBeenCalledWith({
        where: { id: 12 },
        data: {
          suggestion_hash: 'h1',
          suggestion_score: expect.any(Number),
          suggestion_computed_at: expect.any(Date),
        },
      });
    });

    it('manual refresh matches requests without waiting for the suggestion age gate', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS', percentDone: 1, status: 6 },
        ],
      });

      (prisma.request.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 13, title: 'Dune', media_type: 'movie', release_date: '2021-10-22', season_number: null }]);

      await runTransmissionSync(adapter, { ignoreSuggestionAgeGate: true });

      expect(prisma.request.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
        where: { status: 'pending', torrent_hash: null },
      }));
      expect(mockTx.request.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 13 } }));
    });

    it('scheduled sync retains the 60-second suggestion age gate', async () => {
      const adapter = new InMemoryTransmissionAdapter();

      (prisma.request.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await runTransmissionSync(adapter);

      expect(prisma.request.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
        where: {
          status: 'pending',
          torrent_hash: null,
          OR: [
            expect.objectContaining({ suggestion_computed_at: expect.objectContaining({ lt: expect.any(Date) }) }),
            { suggestion_computed_at: { equals: null } },
          ],
        },
      }));
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
