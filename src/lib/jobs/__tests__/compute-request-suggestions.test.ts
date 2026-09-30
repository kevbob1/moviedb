import { computeRequestSuggestions } from '../compute-request-suggestions';

it('delegates request selection to the lifecycle service', async () => {
  const pendingRequestsForNeedsMatch = jest.fn().mockResolvedValue([]);
  const recordSuggestionBatch = jest.fn();

  const result = await computeRequestSuggestions({
    catalog: { suggestionsFor: jest.fn(), getAll: jest.fn(), refresh: jest.fn() },
    requestService: { pendingRequestsForNeedsMatch, recordSuggestionBatch },
  }, { ignoreSuggestionAgeGate: true });

  expect(pendingRequestsForNeedsMatch).toHaveBeenCalledWith({ applySuggestionAgeGate: false });
  expect(recordSuggestionBatch).not.toHaveBeenCalled();
  expect(result).toEqual({ scanned: 0, suggestions: 0, medianScore: 0, parserFailures: 0 });
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
    requestService: { pendingRequestsForNeedsMatch, recordSuggestionBatch: jest.fn() },
  });

  expect(catalog.suggestionsFor).toHaveBeenCalledWith([
    { id: 7, title: 'A Movie', mediaType: 'movie', releaseDate: '2026', seasonNumber: null },
  ]);
});

it('builds one entry per pending request and persists the batch once', async () => {
  const catalog = {
    suggestionsFor: jest.fn().mockResolvedValue({
      suggestions: new Map([[7, { hash: 'abc', score: 0.9 }]]),
      parserFailures: 1,
    }),
    getAll: jest.fn(),
    refresh: jest.fn(),
  };
  const recordSuggestionBatch = jest.fn().mockResolvedValue(undefined);

  const result = await computeRequestSuggestions({
    catalog,
    requestService: {
      pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue([
        { id: 7, title: 'A Movie', media_type: 'movie', release_date: '2026', season_number: null },
        { id: 8, title: 'B Movie', media_type: 'movie', release_date: '2027', season_number: null },
      ]),
      recordSuggestionBatch,
    },
  });

  expect(recordSuggestionBatch).toHaveBeenCalledWith([
    { requestId: 7, suggestion: { hash: 'abc', score: 0.9 } },
    { requestId: 8, suggestion: null },
  ]);
  expect(result).toEqual({ scanned: 2, suggestions: 1, medianScore: 0.9, parserFailures: 1 });
});
