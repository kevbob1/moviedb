import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { runTransmissionSync } from '../transmission-sync';
import { computeRequestSuggestions } from '../compute-request-suggestions';
import { observeRequestCompletions } from '../observe-request-completions';

jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../observe-request-completions', () => ({ observeRequestCompletions: jest.fn() }));
jest.mock('../compute-request-suggestions', () => ({ computeRequestSuggestions: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it('runs completion before suggestions and forwards the manual-refresh option', async () => {
  const order: string[] = [];
  (observeRequestCompletions as jest.Mock).mockImplementation(async () => { order.push('completion'); return { scanned: 1, torrents: 1, fulfilled: 1, problems: 0 }; });
  (computeRequestSuggestions as jest.Mock).mockImplementation(async () => { order.push('suggestions'); return { scanned: 0, suggestions: 0, medianScore: 0, parserFailures: 0, persistenceErrors: [] }; });

  const adapter = { getTorrents: jest.fn(), getAll: jest.fn(), ping: jest.fn() };
  await runTransmissionSync(adapter, { ignoreSuggestionAgeGate: true });

  expect(order).toEqual(['completion', 'suggestions']);
  expect(computeRequestSuggestions).toHaveBeenCalledWith(expect.objectContaining({ prisma, catalog: expect.any(Object) }), { ignoreSuggestionAgeGate: true });
});

it('skips suggestions when completion fails', async () => {
  (observeRequestCompletions as jest.Mock).mockRejectedValue(new Error('completion failed'));

  const adapter = { getTorrents: jest.fn(), getAll: jest.fn(), ping: jest.fn() };
  await expect(runTransmissionSync(adapter)).rejects.toThrow('completion failed');
  expect(computeRequestSuggestions).not.toHaveBeenCalled();
});

it('logs the metrics returned by both phases', async () => {
  (observeRequestCompletions as jest.Mock).mockResolvedValue({ scanned: 2, torrents: 2, fulfilled: 1, problems: 1 });
  (computeRequestSuggestions as jest.Mock).mockResolvedValue({
    scanned: 3,
    suggestions: 2,
    medianScore: 0.8,
    parserFailures: 1,
    persistenceErrors: [],
  });

  await runTransmissionSync({ getTorrents: jest.fn(), getAll: jest.fn(), ping: jest.fn() });

  expect(logger.info).toHaveBeenNthCalledWith(1,
    { scanned: 2, torrents: 2, fulfilled: 1, problems: 1 },
    'transmission_sync completed');
  expect(logger.info).toHaveBeenNthCalledWith(2,
    { scanned: 3, suggestions: 2, medianScore: 0.8, parserFailures: 1 },
    'transmission_sync suggestions computed');
});
