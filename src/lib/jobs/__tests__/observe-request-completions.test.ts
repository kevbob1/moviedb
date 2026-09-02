import { prisma } from '@/lib/prisma';
import { observeRequestCompletions } from '../observe-request-completions';

const mockTx = { request: { update: jest.fn() } };

jest.mock('@/lib/prisma', () => ({
  prisma: { request: { findMany: jest.fn() }, $transaction: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));
});

it('returns completion metrics and uses the injected request lifecycle', async () => {
  (prisma.request.findMany as jest.Mock).mockResolvedValue([{ id: 1, torrent_hash: 'hash' }]);
  const requestService = { fulfillBySync: jest.fn(), flagTorrentProblem: jest.fn() };
  const adapter = {
    getTorrents: jest.fn().mockResolvedValue([{ hash: 'hash', name: 'Movie', status: 6, percentDone: 1 }]),
    ping: jest.fn(),
  };

  const result = await observeRequestCompletions({ adapter, prisma, requestService });

  expect(result).toEqual({ scanned: 1, torrents: 1, fulfilled: 1, problems: 0 });
  expect(requestService.fulfillBySync).toHaveBeenCalledWith(1, mockTx);
});
