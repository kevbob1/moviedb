import { availabilityFor, seasonsForMany } from '@/lib/jellyfin';
import { requestService, RequestService } from '@/lib/request-lifecycle';
import { CreateRequestInput } from '@/lib/request-lifecycle/validators';
import { createTmdbClient, TmdbClient } from '@/lib/tmdb';
import { SeasonsResult } from '@/lib/jellyfin/catalog';
import { Season, SeasonRow, projectAvailability } from './availability';
import { JellyfinImportCatalog, searchCatalog } from './search';

export { projectAvailability } from './availability';
export type { Season, SeasonRow } from './availability';

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
  /** Regular seasons in season order, each already answered for availability. */
  seasonRows: SeasonRow[];
  /** Set when this result's seasons could not be read; its rows are empty. */
  seasonError?: string | null;
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
  const seasonsCache = new Map<number, Promise<Season[]>>();

  /**
   * A TV result's seasons, cached per flow instance so a result repeated across
   * searches costs one TMDB call. Rejects when TMDB cannot be reached; the
   * caller decides whether that is fatal.
   */
  function readSeasons(id: number): Promise<Season[]> {
    const cached = seasonsCache.get(id);
    if (cached) return cached;
    const pending = tmdb.tvDetails(id).then((result) => result.seasons);
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

    // Availability is re-read rather than trusted from the caller's copy: the
    // seasons the caller carries came from this module and do not change.
    const seasons = result.seasonRows?.map((row) => row.season) ?? [];
    const [availability, seasonAvailability] = await Promise.all([
      jellyfin.availabilityFor([result.id]),
      result.mediaType === 'tv' ? jellyfin.seasonsForMany([result.id]) : Promise.resolve({} as Record<number, SeasonsResult>),
    ]);

    return {
      ...result,
      ...projectAvailability(availability[result.id], seasonAvailability[result.id], seasons),
    };
  }

  return {
    search: (query: string, type: 'movie' | 'tv'): Promise<SearchResult> =>
      searchCatalog(tmdb, jellyfin, readSeasons, query, type),
    requestImport,
  };
}

export const defaultImportFlow = createImportFlow({
  tmdb: createTmdbClient(),
  jellyfin: { availabilityFor, seasonsForMany },
  requestService,
});
