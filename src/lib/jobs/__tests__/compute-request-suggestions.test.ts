import { prisma } from '@/lib/prisma';
import { computeRequestSuggestions } from '../compute-request-suggestions';

const mockTx = { request: { update: jest.fn().mockResolvedValue({}) } };

jest.mock('@/lib/prisma', () => ({
  prisma: { request: { findMany: jest.fn() }, $transaction: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));
});

it('forwards the age-gate option and uses the injected clock', async () => {
  const now = new Date('2026-01-02T00:00:00.000Z');
  (prisma.request.findMany as jest.Mock).mockResolvedValue([]);

  const result = await computeRequestSuggestions({
    catalog: { getAll: jest.fn(), refresh: jest.fn() },
    prisma,
    now: () => now,
  }, { ignoreSuggestionAgeGate: true });

  expect(prisma.request.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { status: 'pending', torrent_hash: null },
  }));
  expect(result).toEqual({ scanned: 0, suggestions: 0, medianScore: 0, parserFailures: 0, persistenceErrors: [] });
});

it('loads the full torrent list through the catalog seam', async () => {
  const catalog = { getAll: jest.fn().mockResolvedValue([]), refresh: jest.fn() };
  (prisma.request.findMany as jest.Mock).mockResolvedValue([
    { id: 7, title: 'A Movie', media_type: 'movie', release_date: '2026', season_number: null },
  ]);

  await computeRequestSuggestions({ catalog, prisma, now: () => new Date('2026-01-02T00:00:00.000Z') });

  expect(catalog.getAll).toHaveBeenCalledTimes(1);
});
