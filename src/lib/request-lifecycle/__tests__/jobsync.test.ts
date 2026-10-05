import { createRequestService } from '../repository';

import {
  asPrisma,
  fixedNow,
  makeFakePrisma,
  makeService,
} from './fake-prisma';

describe('request-lifecycle/jobsync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('applySyncDecisions', () => {
    const makeJobService = (fake: ReturnType<typeof makeFakePrisma>) =>
      createRequestService({
        prisma: asPrisma(fake),
        enqueueJob: jest.fn(),
        now: fixedNow,
      });

    it('applies a fulfilled decision with the full resolution column set', async () => {
      const fake = makeFakePrisma();
      const service = makeJobService(fake);

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.downloadRequest(1);
      fake.rows[0].torrent_problem = 'prior problem';
      fake.rows[0].suggestion_hash = 'old-hash';
      fake.rows[0].suggestion_score = 0.95;
      fake.rows[0].suggestion_computed_at = new Date('2026-01-01T00:00:00Z');

      await service.applySyncDecisions([{ requestId: 1, outcome: 'fulfilled' }]);

      expect(fake.rows[0].status).toBe('fulfilled');
      expect(fake.rows[0].torrent_problem).toBeNull();
      expect(fake.rows[0].resolved_at?.toISOString()).toBe('2026-06-15T12:00:00.000Z');
      expect(fake.rows[0].suggestion_hash).toBeNull();
      expect(fake.rows[0].suggestion_score).toBeNull();
      expect(fake.rows[0].suggestion_computed_at).toBeNull();
    });

    it('applies a problem decision stamping torrent_problem only', async () => {
      const fake = makeFakePrisma();
      const service = makeJobService(fake);

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.downloadRequest(1);

      await service.applySyncDecisions([
        { requestId: 1, outcome: 'problem', problem: 'Transmission error: disk full' },
      ]);

      expect(fake.rows[0].torrent_problem).toBe('Transmission error: disk full');
      expect(fake.rows[0].status).toBe('downloading');
      expect(fake.rows[0].resolved_at).toBeNull();
    });

    it('applies nothing when an unknown request id aborts the whole batch', async () => {
      const fake = makeFakePrisma();
      const service = makeJobService(fake);

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.downloadRequest(1);
      fake.rows[0].torrent_problem = 'prior problem';

      await expect(
        service.applySyncDecisions([
          { requestId: 1, outcome: 'fulfilled' },
          { requestId: 999, outcome: 'fulfilled' },
        ]),
      ).rejects.toThrow('Not found');

      expect(fake.rows[0].status).toBe('downloading');
      expect(fake.rows[0].torrent_problem).toBe('prior problem');
      expect(fake.rows[0].resolved_at).toBeNull();
    });
  });

  describe('queueStats', () => {
    it('counts needs-match and needs-attention requests with the right predicates', async () => {
      const countMock = jest.fn().mockResolvedValue(3);
      const service = createRequestService({
        prisma: { request: { count: countMock } } as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob: jest.fn(),
        now: fixedNow,
      });

      const stats = await service.queueStats();

      expect(stats).toEqual({ needsMatch: 3, needsAttention: 3 });
      expect(countMock).toHaveBeenNthCalledWith(1, {
        where: { status: 'pending', torrent_hash: null },
      });
      expect(countMock).toHaveBeenNthCalledWith(2, {
        where: { status: 'downloading', torrent_problem: { not: null } },
      });
    });
  });

  describe('needs-match reads', () => {
    it('reads pending requests without a torrent in requested order by default', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const service = createRequestService({
        prisma: { request: { findMany: findManyMock } } as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob: jest.fn(),
        now: fixedNow,
      });

      await service.pendingRequestsForNeedsMatch();

      expect(findManyMock).toHaveBeenCalledWith({
        where: { status: 'pending', torrent_hash: null },
        orderBy: { requested_at: 'desc' },
      });
    });

    it('applies the suggestion freshness policy when requested by the suggestion job', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const service = createRequestService({
        prisma: { request: { findMany: findManyMock } } as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob: jest.fn(),
        now: fixedNow,
      });

      await service.pendingRequestsForNeedsMatch({ applySuggestionAgeGate: true });

      expect(findManyMock).toHaveBeenCalledWith({
        where: {
          status: 'pending',
          torrent_hash: null,
          OR: [
            { suggestion_computed_at: { lt: new Date('2026-06-15T11:59:00.000Z') } },
            { suggestion_computed_at: { equals: null } },
          ],
        },
        orderBy: { requested_at: 'desc' },
      });
    });

    it('reads downloading requests with torrent problems in requested order', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const service = createRequestService({
        prisma: { request: { findMany: findManyMock } } as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob: jest.fn(),
        now: fixedNow,
      });

      await service.downloadingRequestsWithTorrentProblems();

      expect(findManyMock).toHaveBeenCalledWith({
        where: { status: 'downloading', torrent_problem: { not: null } },
        orderBy: { requested_at: 'desc' },
      });
    });

    it('counts and reads each queue with the same predicate', async () => {
      const countMock = jest.fn().mockResolvedValue(0);
      const findManyMock = jest.fn().mockResolvedValue([]);
      const service = createRequestService({
        prisma: { request: { count: countMock, findMany: findManyMock } } as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob: jest.fn(),
        now: fixedNow,
      });

      await service.queueStats();
      await service.pendingRequestsForNeedsMatch();
      await service.downloadingRequestsWithTorrentProblems();

      const counts = countMock.mock.calls.map((call) => call[0].where);
      const reads = findManyMock.mock.calls.map((call) => call[0].where);

      expect(reads).toEqual(counts);
      expect(counts[0]).toEqual({ status: 'pending', torrent_hash: null });
      expect(counts[1]).toEqual({ status: 'downloading', torrent_problem: { not: null } });
    });
  });

  describe('recordSuggestionBatch', () => {
    it('writes suggestion columns for a present suggestion, stamped from the injected now', async () => {
      const fake = makeFakePrisma();
      const { service } = makeService(fake);
      const request = await service.createRequest({
        tmdbId: 42,
        title: 'A film',
        posterPath: null,
        requestedBy: 'tester',
        mediaType: 'movie',
      });

      await service.recordSuggestionBatch([
        { requestId: request.id, suggestion: { hash: 'suggested-hash', score: 0.85 } },
      ]);

      expect(fake.rows[0].suggestion_hash).toBe('suggested-hash');
      expect(fake.rows[0].suggestion_score).toBe(0.85);
      expect(fake.rows[0].suggestion_computed_at).toEqual(fixedNow());
    });

    it('clears suggestion hash and score when no suggestion matched', async () => {
      const fake = makeFakePrisma();
      const { service } = makeService(fake);
      const request = await service.createRequest({
        tmdbId: 42,
        title: 'A film',
        posterPath: null,
        requestedBy: 'tester',
        mediaType: 'movie',
      });
      fake.rows[0].suggestion_hash = 'old-hash';
      fake.rows[0].suggestion_score = 0.4;

      await service.recordSuggestionBatch([{ requestId: request.id, suggestion: null }]);

      expect(fake.rows[0].suggestion_hash).toBeNull();
      expect(fake.rows[0].suggestion_score).toBeNull();
      expect(fake.rows[0].suggestion_computed_at).toEqual(fixedNow());
    });
  });

  describe('downloadingRequestsWithHashes', () => {
    it('returns only downloading requests with a non-null torrent hash', async () => {
      const fake = makeFakePrisma();
      const { service } = makeService(fake);
      await service.createRequest({
        tmdbId: 1,
        title: 'Linked film',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.createRequest({
        tmdbId: 2,
        title: 'Hashless film',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.createRequest({
        tmdbId: 3,
        title: 'Pending film',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.linkTorrent(1, 'hash1');
      await service.downloadRequest(2);

      const found = await service.downloadingRequestsWithHashes();

      expect(found).toEqual([{ id: 1, torrent_hash: 'hash1' }]);
    });
  });

  describe('activeRequestsForSummary', () => {
    it('fetches pending and downloading requests ordered by requested_at desc', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const service = createRequestService({
        prisma: { request: { findMany: findManyMock } } as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob: jest.fn(),
        now: fixedNow,
      });

      await service.activeRequestsForSummary();

      expect(findManyMock).toHaveBeenCalledWith({
        where: { status: { in: ['pending', 'downloading'] } },
        orderBy: { requested_at: 'desc' },
      });
    });
  });

  describe('retireResolved', () => {
    it('deletes fulfilled requests resolved before the retention cutoff', async () => {
      const deleteManyMock = jest.fn().mockResolvedValue({ count: 4 });
      const service = createRequestService({
        prisma: { request: { deleteMany: deleteManyMock } } as unknown as Parameters<typeof createRequestService>[0]['prisma'],
        enqueueJob: jest.fn(),
        now: fixedNow,
      });

      const deleted = await service.retireResolved(7);

      expect(deleted).toBe(4);
      expect(deleteManyMock).toHaveBeenCalledTimes(1);
      const callArgs = deleteManyMock.mock.calls[0][0];
      expect(callArgs.where.status).toBe('fulfilled');
      expect(callArgs.where.resolved_at).toHaveProperty('lt');
      expect(callArgs.where.resolved_at.lt).toBeInstanceOf(Date);
      expect(callArgs.where.resolved_at.lt.toISOString()).toBe('2026-06-08T12:00:00.000Z');
    });
  });
});
