import { TransmissionAdapter, Torrent } from './adapter';
import { matchSuggestions } from '@/lib/matcher';
import { parseTorrentTitle } from '@viren070/parse-torrent-title';

export interface TransmissionSuggestionRequest {
  id: number;
  title: string;
  mediaType: string;
  releaseDate?: string | Date | null;
  seasonNumber?: number | null;
}

export interface TransmissionSuggestion {
  hash: string;
  score: number;
}

export interface TransmissionSuggestionResult {
  suggestions: Map<number, TransmissionSuggestion | null>;
  parserFailures: number;
}

export interface TransmissionCatalog {
  getAll(): Promise<Torrent[]>;
  suggestionsFor(requests: TransmissionSuggestionRequest[]): Promise<TransmissionSuggestionResult>;
  refresh(): void;
}

const DEFAULT_TTL_MS = 30_000;

export function createTransmissionCatalog(
  adapter: TransmissionAdapter,
  opts?: { ttlMs?: number }
): TransmissionCatalog {
  const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;

  let cached: Torrent[] | null = null;
  let cachedAt = 0;

  return {
    async getAll() {
      const now = Date.now();
      if (cached && now - cachedAt < ttlMs) return cached;
      cached = await adapter.getTorrents();
      cachedAt = now;
      return cached;
    },

    async suggestionsFor(requests) {
      const allTorrents = await this.getAll();
      let parserFailures = 0;
      for (const torrent of allTorrents) {
        for (const source of [torrent.name, ...(torrent.files ?? [])]) {
          if (!source) continue;
          try {
            if (!parseTorrentTitle(source).title) parserFailures++;
          } catch {
            parserFailures++;
          }
        }
      }

      const matched = matchSuggestions(
        requests.map((request) => ({
          id: request.id,
          title: request.title,
          media_type: request.mediaType,
          release_date: request.releaseDate,
          season_number: request.seasonNumber,
        })),
        allTorrents,
      );
      const suggestions = new Map<number, TransmissionSuggestion | null>();
      for (const request of requests) {
        const suggestion = matched.get(request.id);
        suggestions.set(request.id, suggestion ? { hash: suggestion.hash, score: suggestion.score } : null);
      }

      return { suggestions, parserFailures };
    },

    refresh() {
      cached = null;
      cachedAt = 0;
    },
  };
}
