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
    debug: jest.fn(),
  },
}));

import { db } from '../../../../drizzle/db';
import { storeOf } from '../../../test-support/fake-drizzle';
import { InMemoryTransmissionAdapter } from '@/lib/transmission/adapter';
import {
  createTransmissionSync,
  TransmissionSyncDependencies,
} from '@/lib/sync-pass';

const store = storeOf(db);

beforeEach(() => {
  jest.clearAllMocks();
  store.jobs.length = 0;
  store.selects.length = 0;
  store.writes.length = 0;
});

function makeFakeRequestService() {
  return {
    downloadingRequestsWithHashes: jest.fn().mockResolvedValue([]),
    applySyncDecisions: jest.fn().mockResolvedValue({ applied: [], skipped: 0 }),
    pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue([]),
    recordSuggestionBatch: jest.fn(),
    claimedTorrentHashes: jest.fn().mockResolvedValue([]),
    autoLinkBatch: jest.fn(async (entries: Array<{ requestId: number }>) =>
      entries.map((entry) => entry.requestId),
    ),
  };
}

function syncFor(
  adapter: InMemoryTransmissionAdapter,
  requestService: ReturnType<typeof makeFakeRequestService>,
) {
  return createTransmissionSync({
    requestService: requestService as unknown as TransmissionSyncDependencies['requestService'],
    logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
    adapter,
  });
}

describe('transmission sync pass', () => {
  describe('completion happy path', () => {
    it('flips downloading → fulfilled when isFinished is true', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash1', name: 'Movie A', percentDone: 0, status: 6, isFinished: true },
        ],
      });
      const requestService = makeFakeRequestService();
      requestService.downloadingRequestsWithHashes.mockResolvedValue([
        { id: 1, torrent_hash: 'hash1' },
      ]);

      await syncFor(adapter, requestService).run();

      expect(requestService.applySyncDecisions).toHaveBeenCalledWith([
        { requestId: 1, outcome: 'fulfilled' },
      ]);
    });

    it('counts only what the batch actually applied, and reports what it skipped', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash1', name: 'Movie A', percentDone: 0, status: 6, isFinished: true },
          { hash: 'hash2', name: 'Movie B', percentDone: 0.3, status: 4, error: 'disk full' },
        ],
      });
      const requestService = makeFakeRequestService();
      requestService.downloadingRequestsWithHashes.mockResolvedValue([
        { id: 1, torrent_hash: 'hash1' },
        { id: 2, torrent_hash: 'hash2' },
      ]);
      requestService.applySyncDecisions.mockResolvedValue({ applied: [1], skipped: 1 });

      const report = await syncFor(adapter, requestService).run();

      expect(report.downloading).toBe(2);
      expect(report.fulfilled).toBe(1);
      expect(report.problems).toBe(0);
      expect(report.skipped).toBe(1);
    });

    it('reports skipped as 0 when the pass observed nothing', async () => {
      const adapter = new InMemoryTransmissionAdapter({ torrents: [] });
      const requestService = makeFakeRequestService();

      const report = await syncFor(adapter, requestService).run();

      expect(report.skipped).toBe(0);
      expect(report.fulfilled).toBe(0);
      expect(report.problems).toBe(0);
    });

    it('does NOT fulfill while torrent is still downloading (status 4)', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash2', name: 'Movie B', percentDone: 0.5, status: 4 },
        ],
      });
      const requestService = makeFakeRequestService();
      requestService.downloadingRequestsWithHashes.mockResolvedValue([
        { id: 2, torrent_hash: 'hash2' },
      ]);

      await syncFor(adapter, requestService).run();

      expect(requestService.applySyncDecisions).not.toHaveBeenCalled();
    });

    it('flips downloading → fulfilled when status is 6 (seeding)', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash2b', name: 'Movie B2', percentDone: 1, status: 6 },
        ],
      });
      const requestService = makeFakeRequestService();
      requestService.downloadingRequestsWithHashes.mockResolvedValue([
        { id: 22, torrent_hash: 'hash2b' },
      ]);

      await syncFor(adapter, requestService).run();

      expect(requestService.applySyncDecisions).toHaveBeenCalledWith([
        { requestId: 22, outcome: 'fulfilled' },
      ]);
    });
  });

  describe('error stamp (no transition)', () => {
    it('emits a problem decision without a status change when torrent has an error', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash3', name: 'Movie C', percentDone: 0.5, status: 4, error: 'disk full' },
        ],
      });
      const requestService = makeFakeRequestService();
      requestService.downloadingRequestsWithHashes.mockResolvedValue([
        { id: 3, torrent_hash: 'hash3' },
      ]);

      await syncFor(adapter, requestService).run();

      expect(requestService.applySyncDecisions).toHaveBeenCalledWith([
        { requestId: 3, outcome: 'problem', problem: 'Transmission error: disk full' },
      ]);
    });
  });

  describe('disappearance stamp (no transition)', () => {
    it('emits a problem decision when hash is missing from response', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'other-hash', name: 'Other', percentDone: 0, status: 4 },
        ],
      });
      const requestService = makeFakeRequestService();
      requestService.downloadingRequestsWithHashes.mockResolvedValue([
        { id: 4, torrent_hash: 'missing-hash' },
      ]);

      await syncFor(adapter, requestService).run();

      expect(requestService.applySyncDecisions).toHaveBeenCalledWith([
        { requestId: 4, outcome: 'problem', problem: 'Torrent not found in Transmission' },
      ]);
    });
  });

  describe('no-op when idle', () => {
    it('does nothing when no downloading or pending requests exist', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'hash5', name: 'Movie E', percentDone: 1, status: 6, isFinished: true },
        ],
      });
      const requestService = makeFakeRequestService();

      await syncFor(adapter, requestService).run();

      expect(requestService.applySyncDecisions).not.toHaveBeenCalled();
      expect(requestService.recordSuggestionBatch).not.toHaveBeenCalled();
    });
  });

  describe('suggestion computation', () => {
    const pendingMovie = (id: number, title: string) => ({
      id,
      title,
      media_type: 'movie',
      release_date: '2021-10-22',
      season_number: null,
      requested_at: '2026-01-01T00:00:00.000Z',
      requested_by: 'tester',
      status: 'pending',
      torrent_hash: null,
    });

    it('auto-links a pending request at or above the auto-link threshold', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS', percentDone: 1, status: 6 },
        ],
      });
      const requestService = makeFakeRequestService();
      requestService.pendingRequestsForNeedsMatch.mockResolvedValue([pendingMovie(10, 'Dune')]);

      await syncFor(adapter, requestService).run();

      expect(requestService.autoLinkBatch).toHaveBeenCalledWith([
        { requestId: 10, torrentHash: 'h1' },
      ]);
      expect(requestService.recordSuggestionBatch).not.toHaveBeenCalled();
    });

    it('persists an operator-confirmed suggestion below the auto-link threshold', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS', percentDone: 1, status: 6 },
        ],
      });
      const requestService = makeFakeRequestService();
      requestService.pendingRequestsForNeedsMatch.mockResolvedValue([pendingMovie(11, 'Dune Movie')]);

      await syncFor(adapter, requestService).run();

      expect(requestService.autoLinkBatch).not.toHaveBeenCalled();
      expect(requestService.recordSuggestionBatch).toHaveBeenCalledWith([
        { requestId: 11, suggestion: { hash: 'h1', score: 0.5 } },
      ]);
    });

    it('excludes a torrent already claimed by an existing request', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS', percentDone: 1, status: 6 },
        ],
      });
      const requestService = makeFakeRequestService();
      requestService.claimedTorrentHashes.mockResolvedValue(['h1']);
      requestService.pendingRequestsForNeedsMatch.mockResolvedValue([pendingMovie(14, 'Dune')]);

      await syncFor(adapter, requestService).run();

      expect(requestService.autoLinkBatch).not.toHaveBeenCalled();
      expect(requestService.recordSuggestionBatch).toHaveBeenCalledWith([
        { requestId: 14, suggestion: null },
      ]);
    });

    it('allocates a contended torrent to the lowest season and gives the loser no suggestion', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'pack', name: 'Severance.S01.S02.COMPLETE.1080p.WEB-DL.x264-GROUP', percentDone: 1, status: 6 },
        ],
      });
      const requestService = makeFakeRequestService();
      const seasonTwo = {
        id: 22,
        title: 'Severance',
        media_type: 'tv',
        release_date: null,
        season_number: 2,
        requested_at: '2026-01-01T00:00:00.000Z',
        requested_by: 'tester',
        status: 'pending',
        torrent_hash: null,
      };
      const seasonOne = { ...seasonTwo, id: 21, season_number: 1, requested_at: '2026-02-01T00:00:00.000Z' };
      // Season 2 is listed first to prove allocation reorders by season.
      requestService.pendingRequestsForNeedsMatch.mockResolvedValue([seasonTwo, seasonOne]);

      await syncFor(adapter, requestService).run();

      expect(requestService.autoLinkBatch).toHaveBeenCalledWith([
        { requestId: 21, torrentHash: 'pack' },
      ]);
      expect(requestService.recordSuggestionBatch).toHaveBeenCalledWith([
        { requestId: 22, suggestion: null },
      ]);
    });

    it('records a null suggestion when no eligible match exists', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'h1', name: 'Some.Unrelated.Show.S02.COMPLETE.1080p.WEB-DL.x264-GROUP', percentDone: 1, status: 6 },
        ],
      });
      const requestService = makeFakeRequestService();
      requestService.pendingRequestsForNeedsMatch.mockResolvedValue([{
        id: 11,
        title: 'Dune',
        media_type: 'movie',
        release_date: '2021-10-22',
        season_number: null,
        requested_at: '2026-01-01T00:00:00.000Z',
        requested_by: 'tester',
        status: 'pending',
        torrent_hash: null,
      }]);

      await syncFor(adapter, requestService).run();

      expect(requestService.recordSuggestionBatch).toHaveBeenCalledWith([
        { requestId: 11, suggestion: null },
      ]);
    });

    it('auto-links from a contained filename when the torrent name is not descriptive', async () => {
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
      const requestService = makeFakeRequestService();
      requestService.pendingRequestsForNeedsMatch.mockResolvedValue([{
        id: 12,
        title: 'Dune',
        media_type: 'movie',
        release_date: '2021-10-22',
        season_number: null,
        requested_at: '2026-01-01T00:00:00.000Z',
        requested_by: 'tester',
        status: 'pending',
        torrent_hash: null,
      }]);

      await syncFor(adapter, requestService).run();

      expect(requestService.autoLinkBatch).toHaveBeenCalledWith([
        { requestId: 12, torrentHash: 'h1' },
      ]);
    });

    it('manual refresh matches requests without waiting for the suggestion age gate', async () => {
      const adapter = new InMemoryTransmissionAdapter({
        torrents: [
          { hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS', percentDone: 1, status: 6 },
        ],
      });
      const requestService = makeFakeRequestService();
      requestService.pendingRequestsForNeedsMatch.mockResolvedValue([{
        id: 13,
        title: 'Dune',
        media_type: 'movie',
        release_date: '2021-10-22',
        season_number: null,
        requested_at: '2026-01-01T00:00:00.000Z',
        requested_by: 'tester',
        status: 'pending',
        torrent_hash: null,
      }]);

      await syncFor(adapter, requestService).run({ ignoreSuggestionAgeGate: true });

      expect(requestService.pendingRequestsForNeedsMatch).toHaveBeenCalledWith({ applySuggestionAgeGate: false });
      expect(requestService.autoLinkBatch).toHaveBeenCalledWith([
        { requestId: 13, torrentHash: 'h1' },
      ]);
    });

    it('scheduled sync retains the 60-second suggestion age gate', async () => {
      const adapter = new InMemoryTransmissionAdapter();
      const requestService = makeFakeRequestService();

      await syncFor(adapter, requestService).run();

      expect(requestService.pendingRequestsForNeedsMatch).toHaveBeenCalledWith({ applySuggestionAgeGate: true });
    });
  });
});

