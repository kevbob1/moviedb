import { createNeedsMatchRead } from '../read';

describe('needs-match read coverage edges', () => {
  it('reports a non-Error torrent fetch failure as an unknown error', async () => {
    const read = createNeedsMatchRead({
      requestService: {
        pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue([]),
        downloadingRequestsWithTorrentProblems: jest.fn().mockResolvedValue([]),
      },
      getAll: jest.fn().mockRejectedValue('socket closed'),
      ping: jest.fn().mockResolvedValue({ configured: true, reachable: true }),
      latestSyncRun: jest.fn().mockResolvedValue(null),
    });

    await expect(read).resolves.toMatchObject({
      torrents: [],
      transmissionState: 'unreachable',
      transmissionError: 'Unknown error',
      torrentCount: null,
    });
  });

  it('treats a missing torrent problem as an empty description', async () => {
    const attention = [
      {
        id: 3,
        title: 'Unlinked',
        status: 'downloading',
        torrent_problem: null,
        torrent_hash: null,
      },
    ];
    const read = createNeedsMatchRead({
      requestService: {
        pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue([]),
        downloadingRequestsWithTorrentProblems: jest.fn().mockResolvedValue(attention),
      },
      getAll: jest.fn().mockResolvedValue([]),
      ping: jest.fn().mockResolvedValue({ configured: true, reachable: true }),
      latestSyncRun: jest.fn().mockResolvedValue(null),
    });

    await expect(read).resolves.toMatchObject({
      attention: [{ ...attention[0], problem: '', linkedTorrentName: null }],
    });
  });

  it('reports not configured without an error message', async () => {
    const read = createNeedsMatchRead({
      requestService: {
        pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue([]),
        downloadingRequestsWithTorrentProblems: jest.fn().mockResolvedValue([]),
      },
      getAll: jest.fn().mockResolvedValue([]),
      ping: jest.fn().mockResolvedValue({ configured: false, reachable: false }),
      latestSyncRun: jest.fn().mockResolvedValue(null),
    });

    await expect(read).resolves.toMatchObject({
      transmissionState: 'not_configured',
      transmissionError: null,
      torrentCount: 0,
    });
  });
});
