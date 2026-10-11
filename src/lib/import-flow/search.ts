import { AvailabilityResult, SeasonsResult } from '@/lib/jellyfin/catalog';
import { TMDBMovie, TMDBSeries, TmdbClient } from '@/lib/tmdb';
import type { ImportResult } from './index';
import { projectAvailability, Season, summarizeAvailability } from './availability';

export interface JellyfinImportCatalog {
  availabilityFor(ids: number[]): Promise<Record<number, AvailabilityResult>>;
  seasonsForMany(ids: number[]): Promise<Record<number, SeasonsResult>>;
}

/**
 * Reads a TV result's season list. Rejects when TMDB cannot be reached, so the
 * caller decides whether that degrades softly per result or fails the search.
 */
export type ReadSeasons = (id: number) => Promise<Season[]>;

type SearchType = 'movie' | 'tv';

/**
 * One TV result's seasons, or the reason they could not be read. Kept next to
 * the fan-in that needs it so no caller has to ask TMDB for seasons itself.
 */
interface SeasonPlan {
  seasons: Season[];
  error: string | null;
}

const noSeasons: SeasonPlan = { seasons: [], error: null };

export async function searchCatalog(
  tmdb: TmdbClient,
  jellyfin: JellyfinImportCatalog,
  readSeasons: ReadSeasons,
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

  // Seasons arrive with the results: one search returns everything the operator
  // needs to act on, rather than sending them back for a second round per row.
  const plans = await planSeasons(source, type, readSeasons);

  return {
    items: source.map((item, index) => {
      const isMovie = type === 'movie';
      const projection = projectAvailability(
        availability[item.id],
        seasonAvailability[item.id],
        plans[index].seasons,
      );
      return {
        ...item,
        mediaType: type,
        ...(isMovie
          ? { title: (item as TMDBMovie).title }
          : { name: (item as TMDBSeries).name }),
        ...projection,
        seasonError: plans[index].error,
      };
    }),
    availability: summary,
  };
}

/**
 * Reads every TV result's season list in parallel and projects it. One result
 * whose seasons cannot be read degrades on its own; the rest still render.
 */
async function planSeasons(
  source: (TMDBMovie | TMDBSeries)[],
  type: SearchType,
  readSeasons: ReadSeasons,
): Promise<SeasonPlan[]> {
  if (type === 'movie') return source.map(() => noSeasons);

  return Promise.all(
    source.map(async (item) => {
      try {
        return { seasons: await readSeasons(item.id), error: null };
      } catch (error) {
        return {
          seasons: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}
