import { AvailabilityResult, SeasonsResult } from '@/lib/jellyfin/catalog';
import { TMDBMovie, TMDBSeries, TmdbClient } from '@/lib/tmdb';
import type { ImportResult } from './index';
import { projectAvailability, Season, summarizeAvailability } from './availability';

export interface JellyfinImportCatalog {
  availabilityFor(ids: number[]): Promise<Record<number, AvailabilityResult>>;
  seasonsForMany(ids: number[]): Promise<Record<number, SeasonsResult>>;
}

type SearchType = 'movie' | 'tv';

export async function searchCatalog(
  tmdb: TmdbClient,
  jellyfin: JellyfinImportCatalog,
  query: string,
  type: SearchType,
): Promise<{ items: ImportResult[]; availability: { configured: boolean; error: string | null } }> {
  const response = type === 'movie' ? await tmdb.searchMovies(query) : await tmdb.searchTV(query);
  const source = response.results as (TMDBMovie | TMDBSeries)[];
  const ids = source.map((item) => item.id);
  let availability: Record<number, AvailabilityResult> = {};
  let seasonAvailability: Record<number, SeasonsResult> = {};
  let summary = { configured: true, error: null as string | null };
  try {
    [availability, seasonAvailability] = await Promise.all([
      jellyfin.availabilityFor(ids),
      type === 'tv' ? jellyfin.seasonsForMany(ids) : Promise.resolve({}),
    ]);
    summary = summarizeAvailability(availability);
    const catalogError = Object.values(seasonAvailability).find((result) => result.error)?.error;
    if (catalogError) summary = { ...summary, error: summary.error ?? catalogError };
  } catch (error) {
    summary = { configured: false, error: error instanceof Error ? error.message : String(error) };
  }

  return {
    items: source.map((item) => {
      const isMovie = type === 'movie';
      const projection = projectAvailability(availability[item.id], seasonAvailability[item.id]);
      return {
        ...item,
        mediaType: type,
        ...(isMovie ? { title: (item as TMDBMovie).title } : { name: (item as TMDBSeries).name, allSeasons: [] as Season[] }),
        ...projection,
      };
    }),
    availability: summary,
  };
}
