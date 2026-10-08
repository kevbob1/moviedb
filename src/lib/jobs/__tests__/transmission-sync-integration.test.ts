import { requestService } from '@/lib/request-lifecycle';
import { InMemoryTransmissionAdapter } from '@/lib/transmission/adapter';
import { createTransmissionSync, TransmissionSyncDependencies } from '../transmission-sync';

jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/request-lifecycle', () => ({
  requestService: {
    downloadingRequestsWithHashes: jest.fn(),
    applySyncDecisions: jest.fn(),
    pendingRequestsForNeedsMatch: jest.fn(),
    recordSuggestionBatch: jest.fn(),
  },
}));

const downloadingRequestsWithHashesMock = jest.mocked(requestService.downloadingRequestsWithHashes);
const applySyncDecisionsMock = jest.mocked(requestService.applySyncDecisions);
const pendingRequestsMock = jest.mocked(requestService.pendingRequestsForNeedsMatch);
const recordSuggestionBatchMock = jest.mocked(requestService.recordSuggestionBatch);

describe('transmission sync integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    downloadingRequestsWithHashesMock.mockResolvedValue([]);
    applySyncDecisionsMock.mockResolvedValue(undefined);
    recordSuggestionBatchMock.mockResolvedValue(undefined);
    pendingRequestsMock.mockResolvedValue([
      {
        id: 7,
        title: 'A Movie',
        media_type: 'movie',
        release_date: '2026',
        season_number: null,
        requested_by: 'integration-test',
        requested_at: '2026-01-01T00:00:00.000Z',
        status: 'pending',
      },
    ]);
  });

  it('runs one pass: real matcher path, persisted suggestion, merged SyncPassReport', async () => {
    const adapter = new InMemoryTransmissionAdapter({
      torrents: [
        { hash: 'aaa', name: 'A Movie 2026 1080p', percentDone: 1, status: 6 },
        { hash: 'bad', name: '1080p', percentDone: 1, status: 6 },
      ],
    });
    const logger = { debug: jest.fn(), info: jest.fn(), error: jest.fn() };
    const dependencies: TransmissionSyncDependencies = {
      requestService,
      logger,
      adapter,
    };

    const report = await createTransmissionSync(dependencies).run();

    expect(pendingRequestsMock).toHaveBeenCalledWith({ applySuggestionAgeGate: true });
    expect(recordSuggestionBatchMock).toHaveBeenCalledWith([
      { requestId: 7, suggestion: expect.objectContaining({ hash: 'aaa' }) },
    ]);
    expect(report).toEqual({
      downloading: 0,
      fulfilled: 0,
      problems: 0,
      pending: 1,
      suggestions: 1,
      medianScore: expect.any(Number),
      parserFailures: 1,
    });
    expect(logger.info).toHaveBeenCalledWith(
      {
        downloading: 0,
        fulfilled: 0,
        problems: 0,
        pending: 1,
        suggestions: 1,
        medianScore: expect.any(Number),
        parserFailures: 1,
      },
      'transmission_sync completed',
    );
  });
});
