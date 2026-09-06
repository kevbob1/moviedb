import { prisma } from '@/lib/prisma';
import { computeRequestSuggestions } from '../compute-request-suggestions';

const mockTx = { request: { update: jest.fn().mockResolvedValue({}) } };

jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));
});

it('delegates request selection to the lifecycle service', async () => {
  const now = new Date('2026-01-02T00:00:00.000Z');
  const pendingRequestsForNeedsMatch = jest.fn().mockResolvedValue([]);

  const result = await computeRequestSuggestions({
    catalog: { suggestionsFor: jest.fn(), getAll: jest.fn(), refresh: jest.fn() },
    prisma,
    requestService: {
      pendingRequestsForNeedsMatch,
      persistSuggestion: async (requestId, suggestion, computedAt, tx) => {
        await tx.request.update({
          where: { id: requestId },
          data: suggestion
            ? { suggestion_hash: suggestion.hash, suggestion_score: suggestion.score, suggestion_computed_at: computedAt }
            : { suggestion_hash: null, suggestion_score: null, suggestion_computed_at: computedAt },
        });
      },
    },
    now: () => now,
  }, { ignoreSuggestionAgeGate: true });

  expect(pendingRequestsForNeedsMatch).toHaveBeenCalledWith({ applySuggestionAgeGate: false });
  expect(result).toEqual({ scanned: 0, suggestions: 0, medianScore: 0, parserFailures: 0, persistenceErrors: [] });
});

it('loads suggestions and parser failures through the catalog seam', async () => {
  const catalog = {
    suggestionsFor: jest.fn().mockResolvedValue({ suggestions: new Map(), parserFailures: 0 }),
    getAll: jest.fn(),
    refresh: jest.fn(),
  };
  const pendingRequestsForNeedsMatch = jest.fn().mockResolvedValue([
    { id: 7, title: 'A Movie', media_type: 'movie', release_date: '2026', season_number: null },
  ]);

  await computeRequestSuggestions({
    catalog,
    prisma,
    requestService: { pendingRequestsForNeedsMatch, persistSuggestion: jest.fn() },
    now: () => new Date('2026-01-02T00:00:00.000Z'),
  });

  expect(catalog.suggestionsFor).toHaveBeenCalledWith([
    { id: 7, title: 'A Movie', mediaType: 'movie', releaseDate: '2026', seasonNumber: null },
  ]);
});
