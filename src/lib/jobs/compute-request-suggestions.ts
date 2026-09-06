import type { PrismaClient } from '@/generated/prisma/client';
import type { TransmissionCatalog } from '@/lib/transmission/catalog';
import type { RequestService } from '@/lib/request-lifecycle';

export interface ComputeRequestSuggestionsResult {
  scanned: number;
  suggestions: number;
  medianScore: number;
  parserFailures: number;
  persistenceErrors: Array<{ err: unknown; requestId: number }>;
}

interface ComputeRequestSuggestionsDeps {
  catalog: TransmissionCatalog;
  prisma: PrismaClient;
  requestService: Pick<RequestService, 'pendingRequestsForNeedsMatch' | 'persistSuggestion'>;
  now: () => Date;
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
  prisma,
  requestService,
  now: getNow,
}: ComputeRequestSuggestionsDeps,
  { ignoreSuggestionAgeGate = false }: ComputeRequestSuggestionsOptions = {},
): Promise<ComputeRequestSuggestionsResult> {
  const now = getNow();
  const pendingRequests = await requestService.pendingRequestsForNeedsMatch({
    applySuggestionAgeGate: !ignoreSuggestionAgeGate,
  });

  if (pendingRequests.length === 0) {
    return { scanned: 0, suggestions: 0, medianScore: 0, parserFailures: 0, persistenceErrors: [] };
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
  const persistenceErrors: Array<{ err: unknown; requestId: number }> = [];

  await prisma.$transaction(async (tx) => {
    for (const request of pendingRequests) {
      try {
        const suggestion = suggestions.get(request.id) ?? null;
        if (suggestion) {
          withSuggestion++;
          scores.push(suggestion.score);
          await requestService.persistSuggestion(request.id, suggestion, now, tx);
        } else {
          await requestService.persistSuggestion(request.id, null, now, tx);
        }
      } catch (err) {
        persistenceErrors.push({ err, requestId: request.id });
      }
    }
  });

  return {
    scanned: pendingRequests.length,
    suggestions: withSuggestion,
    medianScore: median(scores),
    parserFailures,
    persistenceErrors,
  };
}
