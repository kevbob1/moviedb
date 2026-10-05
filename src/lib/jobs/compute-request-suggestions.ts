import type { TransmissionCatalog } from '@/lib/transmission/catalog';
import type { RequestJobSync, SuggestionEntry } from '@/lib/request-lifecycle';

export interface ComputeRequestSuggestionsResult {
  scanned: number;
  suggestions: number;
  medianScore: number;
  parserFailures: number;
}

interface ComputeRequestSuggestionsDeps {
  catalog: TransmissionCatalog;
  requestService: Pick<RequestJobSync, 'pendingRequestsForNeedsMatch' | 'recordSuggestionBatch'>;
}

interface ComputeRequestSuggestionsOptions {
  ignoreSuggestionAgeGate?: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function computeRequestSuggestions({
  catalog,
  requestService,
}: ComputeRequestSuggestionsDeps,
  { ignoreSuggestionAgeGate = false }: ComputeRequestSuggestionsOptions = {},
): Promise<ComputeRequestSuggestionsResult> {
  const pendingRequests = await requestService.pendingRequestsForNeedsMatch({
    applySuggestionAgeGate: !ignoreSuggestionAgeGate,
  });

  if (pendingRequests.length === 0) {
    return { scanned: 0, suggestions: 0, medianScore: 0, parserFailures: 0 };
  }

  const { suggestions, parserFailures } = await catalog.suggestionsFor(
    pendingRequests.map((request) => ({
      id: request.id,
      title: request.title,
      mediaType: request.media_type ?? '',
      releaseDate: request.release_date,
      seasonNumber: request.season_number,
    })),
  );
  let withSuggestion = 0;
  const scores: number[] = [];
  const entries: SuggestionEntry[] = pendingRequests.map((request) => {
    const suggestion = suggestions.get(request.id) ?? null;
    if (suggestion) {
      withSuggestion++;
      scores.push(suggestion.score);
    }
    return { requestId: request.id, suggestion };
  });

  await requestService.recordSuggestionBatch(entries);

  return {
    scanned: pendingRequests.length,
    suggestions: withSuggestion,
    medianScore: median(scores),
    parserFailures,
  };
}
