import {
  createTransmissionSync,
  createTransmissionSyncHandler,
  TransmissionSyncDependencies,
} from '../transmission-sync';
import { observeRequestCompletions } from '../observe-request-completions';
import { computeRequestSuggestions } from '../compute-request-suggestions';
import { TransmissionAdapter } from '@/lib/transmission/adapter';
import { prisma } from '@/lib/prisma';
import { requestService } from '@/lib/request-lifecycle';

jest.mock('../observe-request-completions', () => ({
  observeRequestCompletions: jest.fn(),
}));
jest.mock('../compute-request-suggestions', () => ({
  computeRequestSuggestions: jest.fn(),
}));

const observeMock = jest.mocked(observeRequestCompletions);
const suggestionsMock = jest.mocked(computeRequestSuggestions);

function dependencies(): TransmissionSyncDependencies {
  return {
    prisma: {} as unknown as typeof prisma,
    requestService: {} as unknown as typeof requestService,
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    },
    adapter: {} as unknown as TransmissionAdapter,
  };
}

describe('transmission sync construction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    observeMock.mockResolvedValue({ scanned: 0, torrents: 0, fulfilled: 0, problems: 0 });
    suggestionsMock.mockResolvedValue({
      scanned: 0,
      suggestions: 0,
      medianScore: 0,
      parserFailures: 0,
      persistenceErrors: [],
    });
  });

  it('passes injected dependencies to each internal phase in order', async () => {
    const injected = dependencies();
    const sync = createTransmissionSync(injected);

    await sync.run();

    expect(observeMock).toHaveBeenCalledWith({
      adapter: injected.adapter,
      prisma: injected.prisma,
      requestService: injected.requestService,
    });
    expect(suggestionsMock).toHaveBeenCalledWith(
      expect.objectContaining({ adapter: injected.adapter, prisma: injected.prisma }),
      { ignoreSuggestionAgeGate: false },
    );
    expect(observeMock.mock.invocationCallOrder[0]).toBeLessThan(
      suggestionsMock.mock.invocationCallOrder[0],
    );
  });

  it('does not start suggestions when completion observation fails', async () => {
    const failure = new Error('completion failed');
    observeMock.mockRejectedValue(failure);

    await expect(createTransmissionSync(dependencies()).run()).rejects.toBe(failure);
    expect(suggestionsMock).not.toHaveBeenCalled();
  });

  it('constructs a job handler from the injected orchestration', async () => {
    const injected = dependencies();

    await createTransmissionSyncHandler(injected).handle({});

    expect(observeMock).toHaveBeenCalled();
    expect(suggestionsMock).toHaveBeenCalled();
  });
});
