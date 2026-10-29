import { createRequestService } from '../repository';

import { makeFakeDrizzle, renderSql } from '../../../test-support/fake-drizzle';
import {
  asPrisma,
  fixedNow,
  makeFakePrisma,
  makeService,
} from './fake-prisma';

/** Reads go through Drizzle now; writes still go through the Prisma fake. */
const makeReadService = (fake: ReturnType<typeof makeFakeDrizzle>) =>
  createRequestService({
    prisma: asPrisma(makeFakePrisma()),
    db: fake.db,
    enqueueJob: jest.fn(),
    now: fixedNow,
  });

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

      const result = await service.applySyncDecisions([{ requestId: 1, outcome: 'fulfilled' }]);

      expect(result).toEqual({ applied: [1], skipped: 0 });
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

      const result = await service.applySyncDecisions([
        { requestId: 1, outcome: 'problem', problem: 'Transmission error: disk full' },
      ]);

      expect(result).toEqual({ applied: [], skipped: 0 });
      expect(fake.rows[0].torrent_problem).toBe('Transmission error: disk full');
      expect(fake.rows[0].status).toBe('downloading');
      expect(fake.rows[0].resolved_at).toBeNull();
    });

    it('skips a verdict for a request that is gone and keeps the rest of the batch', async () => {
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

      const result = await service.applySyncDecisions([
        { requestId: 1, outcome: 'fulfilled' },
        { requestId: 999, outcome: 'fulfilled' },
      ]);

      expect(result).toEqual({ applied: [1], skipped: 1 });
      expect(fake.rows[0].status).toBe('fulfilled');
      expect(fake.rows[0].resolved_at?.toISOString()).toBe('2026-06-15T12:00:00.000Z');
    });

    it('skips a fulfilled verdict for a request the operator already fulfilled', async () => {
      const fake = makeFakePrisma();
      const service = makeJobService(fake);

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });
      await service.fulfillRequest(1);
      const resolvedAt = fake.rows[0].resolved_at;

      const result = await service.applySyncDecisions([{ requestId: 1, outcome: 'fulfilled' }]);

      expect(result).toEqual({ applied: [], skipped: 1 });
      expect(fake.rows[0].status).toBe('fulfilled');
      expect(fake.rows[0].resolved_at).toEqual(resolvedAt);
    });

    it('skips a problem verdict for a request deleted before the batch ran', async () => {
      const fake = makeFakePrisma();
      const service = makeJobService(fake);

      await service.createRequest({
        tmdbId: 1,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });

      const result = await service.applySyncDecisions([
        { requestId: 1, outcome: 'problem', problem: 'Transmission error: disk full' },
        { requestId: 999, outcome: 'problem', problem: 'Torrent not found in Transmission' },
      ]);

      expect(result).toEqual({ applied: [], skipped: 1 });
      expect(fake.rows[0].torrent_problem).toBe('Transmission error: disk full');
    });

    it('reports nothing applied when there is no verdict to apply', async () => {
      const fake = makeFakePrisma();
      const service = makeJobService(fake);

      await expect(service.applySyncDecisions([])).resolves.toEqual({ applied: [], skipped: 0 });
      expect(fake.request.update).not.toHaveBeenCalled();
      expect(fake.request.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('queueStats', () => {
    it('counts needs-match and needs-attention requests with the right predicates', async () => {
      const fake = makeFakeDrizzle({ count: 3 });
      const service = makeReadService(fake);

      const stats = await service.queueStats();

      const [needsMatch, needsAttention] = fake.selects;
      expect(stats).toEqual({ needsMatch: 3, needsAttention: 3 });
      expect(fake.selects.map((select) => select.kind)).toEqual(['count', 'count']);
      expect(renderSql(needsMatch.where)?.params).toEqual(['pending']);
      expect(renderSql(needsMatch.where)?.sql).toContain('"requests"."status" = $1');
      expect(renderSql(needsMatch.where)?.sql).toContain('"requests"."torrent_hash" is null');
      expect(renderSql(needsAttention.where)?.params).toEqual(['downloading']);
      expect(renderSql(needsAttention.where)?.sql).toContain('"requests"."status" = $1');
      expect(renderSql(needsAttention.where)?.sql).toContain('"requests"."torrent_problem" is not null');
    });
  });

  describe('needs-match reads', () => {
    it('reads pending requests without a torrent in requested order by default', async () => {
      const fake = makeFakeDrizzle({ rows: [] });
      const service = makeReadService(fake);

      await service.pendingRequestsForNeedsMatch();

      const [query] = fake.selects;
      expect(renderSql(query.where)?.params).toEqual(['pending']);
      expect(renderSql(query.where)?.sql).toContain('"requests"."status" = $1');
      expect(renderSql(query.where)?.sql).toContain('"requests"."torrent_hash" is null');
      expect(renderSql(query.orderBy)?.sql).toBe('"requests"."requested_at" desc');
    });

    it('applies the suggestion freshness policy when requested by the suggestion job', async () => {
      const fake = makeFakeDrizzle({ rows: [] });
      const service = makeReadService(fake);

      await service.pendingRequestsForNeedsMatch({ applySuggestionAgeGate: true });

      const [query] = fake.selects;
      const rendered = renderSql(query.where);
      expect(rendered?.params).toEqual([
        'pending',
        // timestamp columns bind as ISO strings on the wire
        '2026-06-15T11:59:00.000Z',
      ]);
      expect(rendered?.sql).toContain('"requests"."suggestion_computed_at" < $2');
      expect(rendered?.sql).toContain('"requests"."suggestion_computed_at" is null');
      expect(rendered?.sql).toContain(' or ');
    });

    it('reads downloading requests with torrent problems in requested order', async () => {
      const fake = makeFakeDrizzle({ rows: [] });
      const service = makeReadService(fake);

      await service.downloadingRequestsWithTorrentProblems();

      const [query] = fake.selects;
      expect(renderSql(query.where)?.params).toEqual(['downloading']);
      expect(renderSql(query.where)?.sql).toContain('"requests"."torrent_problem" is not null');
      expect(renderSql(query.orderBy)?.sql).toBe('"requests"."requested_at" desc');
    });

    it('counts and reads each queue with the same predicate', async () => {
      const fake = makeFakeDrizzle({ count: 0, rows: [] });
      const service = makeReadService(fake);

      await service.queueStats();
      await service.pendingRequestsForNeedsMatch();
      await service.downloadingRequestsWithTorrentProblems();

      const [needsMatchCount, needsAttentionCount, needsMatchRead, needsAttentionRead] =
        fake.selects;

      expect(renderSql(needsMatchRead.where)).toEqual(renderSql(needsMatchCount.where));
      expect(renderSql(needsAttentionRead.where)).toEqual(renderSql(needsAttentionCount.where));
      expect(renderSql(needsMatchCount.where)?.params).toEqual(['pending']);
      expect(renderSql(needsAttentionCount.where)?.params).toEqual(['downloading']);
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

  describe('claimedTorrentHashes', () => {
    it('returns the hash of every request that holds one, whatever its status', async () => {
      const fake = makeFakeDrizzle({
        rows: [
          { torrent_hash: 'claimed-pending' },
          { torrent_hash: 'claimed-fulfilled' },
        ],
      });
      const service = makeReadService(fake);

      expect(await service.claimedTorrentHashes()).toEqual([
        'claimed-pending',
        'claimed-fulfilled',
      ]);

      const rendered = renderSql(fake.selects[0].where);
      // ADR-0009: status plays no part in the claim.
      expect(rendered?.sql).toContain('"requests"."torrent_hash" is not null');
      expect(rendered?.sql).not.toContain('status');
      expect(rendered?.params).toEqual([]);
    });
  });

  describe('autoLinkBatch', () => {
    it('links a pending request through the FSM side-effects and returns the id', async () => {
      const fake = makeFakePrisma();
      const { service } = makeService(fake);
      await service.createRequest({ tmdbId: 1, title: 'Dune', posterPath: null, requestedBy: 'tester', mediaType: 'movie' });
      fake.rows[0].suggestion_hash = 'old-hash';
      fake.rows[0].suggestion_score = 0.5;
      fake.rows[0].torrent_problem = 'stale problem';

      const linked = await service.autoLinkBatch([{ requestId: 1, torrentHash: 'h1' }]);

      expect(linked).toEqual([1]);
      expect(fake.rows[0].status).toBe('downloading');
      expect(fake.rows[0].torrent_hash).toBe('h1');
      expect(fake.rows[0].torrent_problem).toBeNull();
      expect(fake.rows[0].suggestion_hash).toBeNull();
      expect(fake.rows[0].suggestion_score).toBeNull();
      expect(fake.rows[0].suggestion_computed_at).toBeNull();
    });

    it('skips requests that are no longer pending without aborting the batch', async () => {
      const fake = makeFakePrisma();
      const { service } = makeService(fake);
      await service.createRequest({ tmdbId: 1, title: 'A film', posterPath: null, requestedBy: 'tester', mediaType: 'movie' });
      await service.createRequest({ tmdbId: 2, title: 'Another film', posterPath: null, requestedBy: 'tester', mediaType: 'movie' });
      await service.downloadRequest(2);

      const linked = await service.autoLinkBatch([
        { requestId: 1, torrentHash: 'h1' },
        { requestId: 2, torrentHash: 'h2' },
      ]);

      expect(linked).toEqual([1]);
      expect(fake.rows[0].torrent_hash).toBe('h1');
      expect(fake.rows[1].torrent_hash).toBeNull();
    });

    it('is a no-op for an empty batch', async () => {
      const fake = makeFakePrisma();
      const { service } = makeService(fake);

      expect(await service.autoLinkBatch([])).toEqual([]);
      expect(fake.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('downloadingRequestsWithHashes', () => {
    it('returns only downloading requests with a non-null torrent hash', async () => {
      const fake = makeFakeDrizzle({
        rows: [
          { id: 1, torrent_hash: 'hash1' },
          { id: 2, torrent_hash: null },
        ],
      });
      const service = makeReadService(fake);

      const found = await service.downloadingRequestsWithHashes();

      expect(found).toEqual([{ id: 1, torrent_hash: 'hash1' }]);

      const rendered = renderSql(fake.selects[0].where);
      expect(rendered?.params).toEqual(['downloading']);
      expect(rendered?.sql).toContain('"requests"."status" = $1');
      expect(rendered?.sql).toContain('"requests"."torrent_hash" is not null');
    });
  });

  describe('activeRequestsForSummary', () => {
    it('fetches pending and downloading requests ordered by requested_at desc', async () => {
      const fake = makeFakeDrizzle({ rows: [] });
      const service = makeReadService(fake);

      await service.activeRequestsForSummary();

      const [query] = fake.selects;
      const rendered = renderSql(query.where);
      expect(rendered?.params).toEqual(['pending', 'downloading']);
      expect(rendered?.sql).toContain('"requests"."status" in ($1, $2)');
      expect(renderSql(query.orderBy)?.sql).toBe('"requests"."requested_at" desc');
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
