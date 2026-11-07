import { createTransmissionSync } from '@/lib/sync-pass';
import { InMemoryTransmissionAdapter } from '@/lib/transmission/adapter';

import { createTransmissionSyncHandler } from '../transmission-sync';

const mockRun = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/sync-pass', () => ({
  createTransmissionSync: jest.fn(() => ({ run: mockRun })),
}));

const createTransmissionSyncMock = jest.mocked(createTransmissionSync);

function handlerFor() {
  return createTransmissionSyncHandler({
    logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
    adapter: new InMemoryTransmissionAdapter(),
  });
}

describe('transmission sync job handler', () => {
  it('ignores the suggestion age gate on a manual trigger', async () => {
    await handlerFor().handle({ trigger: 'manual' });

    expect(mockRun).toHaveBeenCalledWith({ ignoreSuggestionAgeGate: true });
  });

  it('retains the age gate on a scheduled trigger', async () => {
    await handlerFor().handle({ trigger: 'scheduled' });

    expect(mockRun).toHaveBeenCalledWith({ ignoreSuggestionAgeGate: false });
  });

  it('falls back to the scheduled trigger for an unknown payload', async () => {
    await handlerFor().handle({ something: 'else' });

    expect(mockRun).toHaveBeenCalledWith({ ignoreSuggestionAgeGate: false });
  });

  it('builds the pass from the injected dependencies', async () => {
    const adapter = new InMemoryTransmissionAdapter();
    const logger = { debug: jest.fn(), info: jest.fn(), error: jest.fn() };

    await createTransmissionSyncHandler({ logger, adapter }).handle({ trigger: 'manual' });

    expect(createTransmissionSyncMock).toHaveBeenCalledWith({ logger, adapter });
  });
});
