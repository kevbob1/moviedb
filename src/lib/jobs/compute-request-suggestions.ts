import type { PrismaClient } from '@/generated/prisma/client';
import type { TransmissionAdapter } from '@/lib/transmission/adapter';
import { matchSuggestions } from '@/lib/matcher';
import { parseTorrentTitle } from '@viren070/parse-torrent-title';

export interface ComputeRequestSuggestionsResult {
  scanned: number;
  suggestions: number;
  medianScore: number;
  parserFailures: number;
  persistenceErrors: Array<{ err: unknown; requestId: number }>;
}

interface ComputeRequestSuggestionsDeps {
  adapter: TransmissionAdapter;
  prisma: PrismaClient;
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
  adapter,
  prisma,
  now: getNow,
}: ComputeRequestSuggestionsDeps,
  { ignoreSuggestionAgeGate = false }: ComputeRequestSuggestionsOptions = {},
): Promise<ComputeRequestSuggestionsResult> {
  const now = getNow();
  const pendingRequests = await prisma.request.findMany({
    where: ignoreSuggestionAgeGate
      ? { status: 'pending', torrent_hash: null }
      : {
          status: 'pending',
          torrent_hash: null,
          OR: [
            { suggestion_computed_at: { lt: new Date(now.getTime() - 60_000) } },
            { suggestion_computed_at: { equals: null } },
          ],
        },
    select: { id: true, title: true, media_type: true, release_date: true, season_number: true },
  });

  if (pendingRequests.length === 0) {
    return { scanned: 0, suggestions: 0, medianScore: 0, parserFailures: 0, persistenceErrors: [] };
  }

  const allTorrents = await adapter.getAll();
  let parserFailures = 0;
  for (const torrent of allTorrents) {
    for (const source of [torrent.name, ...(torrent.files ?? [])]) {
      if (source && !parseTorrentTitle(source).title) parserFailures++;
    }
  }

  const suggestions = matchSuggestions(pendingRequests, allTorrents);
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
          await tx.request.update({
            where: { id: request.id },
            data: { suggestion_hash: suggestion.hash, suggestion_score: suggestion.score, suggestion_computed_at: now },
          });
        } else {
          await tx.request.update({
            where: { id: request.id },
            data: { suggestion_hash: null, suggestion_score: null, suggestion_computed_at: now },
          });
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
