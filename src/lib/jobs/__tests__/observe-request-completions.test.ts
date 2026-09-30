import { observeRequestCompletions } from '../observe-request-completions';

it('returns completion metrics and uses the injected request lifecycle', async () => {
  const requestService = {
    downloadingRequestsWithHashes: jest.fn().mockResolvedValue([
      { id: 1, torrent_hash: 'hash' },
      { id: 2, torrent_hash: 'gone' },
      { id: 3, torrent_hash: 'broken' },
      { id: 4, torrent_hash: 'downloading' },
    ]),
    applySyncDecisions: jest.fn().mockResolvedValue(undefined),
  };
  const adapter = {
    getTorrents: jest.fn().mockResolvedValue([
      { hash: 'hash', name: 'Movie', status: 6, percentDone: 1 },
      { hash: 'broken', name: 'Broken', status: 4, percentDone: 0.5, error: 'disk full' },
      { hash: 'downloading', name: 'Not Done', status: 4, percentDone: 0.5 },
    ]),
    ping: jest.fn(),
  };

  const result = await observeRequestCompletions({ adapter, requestService });

  expect(requestService.applySyncDecisions).toHaveBeenCalledWith([
    { requestId: 1, outcome: 'fulfilled' },
    { requestId: 2, outcome: 'problem', problem: 'Torrent not found in Transmission' },
    { requestId: 3, outcome: 'problem', problem: 'Transmission error: disk full' },
  ]);
  expect(result).toEqual({ scanned: 4, torrents: 3, fulfilled: 1, problems: 2 });
});

it('applies no decisions when nothing is downloading', async () => {
  const requestService = {
    downloadingRequestsWithHashes: jest.fn().mockResolvedValue([]),
    applySyncDecisions: jest.fn(),
  };
  const adapter = { getTorrents: jest.fn(), ping: jest.fn() };

  const result = await observeRequestCompletions({ adapter, requestService });

  expect(adapter.getTorrents).not.toHaveBeenCalled();
  expect(requestService.applySyncDecisions).not.toHaveBeenCalled();
  expect(result).toEqual({ scanned: 0, torrents: 0, fulfilled: 0, problems: 0 });
});
