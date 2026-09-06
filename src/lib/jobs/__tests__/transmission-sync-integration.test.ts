import { prisma } from '@/lib/prisma';
import { requestService } from '@/lib/request-lifecycle';
import { createTransmissionCatalog } from '@/lib/transmission/catalog';
import { InMemoryTransmissionAdapter } from '@/lib/transmission/adapter';
import { createTransmissionSyncHandler, TransmissionSyncDependencies } from '../transmission-sync';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    request: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (callback: (tx: object) => Promise<void>) => callback({})),
  },
}));
jest.mock('@/lib/request-lifecycle', () => ({
  requestService: {
    pendingRequestsForNeedsMatch: jest.fn(),
    persistSuggestion: jest.fn(),
  },
}));

const pendingRequestsMock = jest.mocked(requestService.pendingRequestsForNeedsMatch);
const persistSuggestionMock = jest.mocked(requestService.persistSuggestion);

describe('transmission sync integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    persistSuggestionMock.mockResolvedValue(undefined);
  });

  it('uses the real catalog suggestion path and persists its result', async () => {
    const adapter = new InMemoryTransmissionAdapter({
      torrents: [
        { hash: 'aaa', name: 'A Movie 2026 1080p', percentDone: 1, status: 6 },
        { hash: 'bad', name: '1080p', percentDone: 1, status: 6 },
      ],
    });
    const catalog = createTransmissionCatalog(adapter);
    const suggestionsForSpy = jest.spyOn(catalog, 'suggestionsFor');
    const logger = { debug: jest.fn(), info: jest.fn(), error: jest.fn() };
    const dependencies: TransmissionSyncDependencies = {
      prisma,
      requestService,
      logger,
      adapter,
      catalog,
    };

    await createTransmissionSyncHandler(dependencies).handle({ trigger: 'scheduled' });

    expect(suggestionsForSpy).toHaveBeenCalledWith([
      {
        id: 7,
        title: 'A Movie',
        mediaType: 'movie',
        releaseDate: '2026',
        seasonNumber: null,
      },
    ]);
    expect(persistSuggestionMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ hash: 'aaa' }),
      expect.any(Date),
      expect.any(Object),
    );
    expect(logger.info).toHaveBeenCalledWith(
      { scanned: 1, suggestions: 1, medianScore: expect.any(Number), parserFailures: 1 },
      'transmission_sync suggestions computed',
    );
  });
});
