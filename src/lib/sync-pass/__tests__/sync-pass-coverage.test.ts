jest.mock('../../../../drizzle/db', () => {
  const { makeInMemoryDrizzle } = jest.requireActual('../../../test-support/fake-drizzle');
  const fake = makeInMemoryDrizzle();
  return { db: fake.db };
});

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { logger } from '@/lib/logger';
import { createTransmissionSync } from '@/lib/sync-pass';
import {
  TransmissionNotConfiguredError,
  type TransmissionAdapter,
} from '@/lib/transmission/adapter';

function makeRequestService() {
  return {
    downloadingRequestsWithHashes: jest.fn().mockResolvedValue([]),
    applySyncDecisions: jest.fn().mockResolvedValue({ applied: [], skipped: 0 }),
    pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue([]),
    recordSuggestionBatch: jest.fn(),
    claimedTorrentHashes: jest.fn().mockResolvedValue([]),
    autoLinkBatch: jest.fn(async () => []),
  };
}

const emptyReport = {
  downloading: 0,
  fulfilled: 0,
  problems: 0,
  skipped: 0,
  pending: 0,
  suggestions: 0,
  autoLinked: 0,
  medianScore: 0,
  parserFailures: 0,
};

describe('sync pass coverage edges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('treats transmission being unconfigured as an empty observation', async () => {
    const adapter: TransmissionAdapter = {
      getTorrents: jest.fn().mockRejectedValue(new TransmissionNotConfiguredError()),
      ping: jest.fn(),
    };
    const requestService = makeRequestService();
    requestService.downloadingRequestsWithHashes.mockResolvedValue([
      { id: 1, torrent_hash: 'hash1' },
    ]);

    const sync = createTransmissionSync({
      requestService: requestService as never,
      logger,
      adapter,
    });

    await expect(sync.run()).resolves.toEqual(emptyReport);
    expect(requestService.applySyncDecisions).not.toHaveBeenCalled();
  });

  it('logs an idle pass at debug level', async () => {
    const adapter: TransmissionAdapter = {
      getTorrents: jest.fn().mockResolvedValue([]),
      ping: jest.fn(),
    };

    const sync = createTransmissionSync({
      requestService: makeRequestService() as never,
      logger,
      adapter,
    });

    await sync.run();

    expect(logger.debug).toHaveBeenCalledWith(emptyReport, 'transmission_sync completed');
    expect(logger.info).not.toHaveBeenCalled();
  });
});
