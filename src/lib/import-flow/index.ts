import { availabilityFor, seasonsForMany } from '@/lib/jellyfin';
import { requestService, RequestService } from '@/lib/request-lifecycle';
import { CreateRequestInput } from '@/lib/request-lifecycle/validators';
import { createTmdbClient, TmdbClient } from '@/lib/tmdb';
import { SeasonsResult } from '@/lib/jellyfin/catalog';
import { projectAvailability, Season } from './availability';
import { JellyfinImportCatalog, searchCatalog } from './search';

export { projectAvailability } from './availability';
export type { Season } from './availability';

export interface ImportResult {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  mediaType: 'movie' | 'tv';
  onJellyfin: boolean;
  availableSeasons: number[];
  missingSeasons: number[];
  allSeasons?: Season[];
  genre_ids?: number[];
}

export interface SearchResult {
  items: ImportResult[];
  availability: { configured: boolean; error: string | null };
}

export interface ImportFlowDependencies {
  tmdb: TmdbClient;
  jellyfin: JellyfinImportCatalog;
  requestService: Pick<RequestService, 'createRequest' | 'createTvRequests'>;
}

export function createImportFlow({ tmdb, jellyfin, requestService }: ImportFlowDependencies) {
  const seasonsCache = new Map<number, Promise<Season[] | null>>();

  async function seasonsFor(id: number): Promise<Season[] | null> {
    const cached = seasonsCache.get(id);
    if (cached) return cached;
    const pending = tmdb.tvDetails(id).then((result) => result.seasons).catch(() => null);
    seasonsCache.set(id, pending);
    return pending;
  }

  async function requestImport(result: ImportResult, seasonNumber: number | 'all', requestedBy: string): Promise<ImportResult> {
    const title = result.title ?? result.name ?? '';
    const input: CreateRequestInput = {
      tmdbId: result.id,
      title,
      posterPath: result.poster_path ?? null,
      requestedBy,
      releaseDate: result.release_date ?? result.first_air_date,
      overview: result.overview,
      genreIds: result.genre_ids,
      mediaType: result.mediaType,
      ...(result.mediaType === 'tv' && seasonNumber !== 'all' ? { seasonNumber } : {}),
    };
    if (result.mediaType === 'tv' && seasonNumber === 'all') {
      await requestService.createTvRequests(result.id, requestedBy);
    } else {
      await requestService.createRequest(input);
    }
    const [availability, seasonAvailability] = await Promise.all([
      jellyfin.availabilityFor([result.id]),
      result.mediaType === 'tv' ? jellyfin.seasonsForMany([result.id]) : Promise.resolve({} as Record<number, SeasonsResult>),
    ]);
    return {
      ...result,
      ...projectAvailability(
        availability[result.id],
        seasonAvailability[result.id],
        result.allSeasons ?? (result.mediaType === 'tv' ? await seasonsFor(result.id) ?? [] : []),
      ),
    };
  }

  return {
    search: (query: string, type: 'movie' | 'tv'): Promise<SearchResult> => searchCatalog(tmdb, jellyfin, query, type),
    seasonsFor,
    requestImport,
  };
}

export const defaultImportFlow = createImportFlow({
  tmdb: createTmdbClient(),
  jellyfin: { availabilityFor, seasonsForMany },
  requestService,
});
