import { TMDBSeason } from '@/lib/tmdb';
import { AvailabilityResult, SeasonsResult } from '@/lib/jellyfin/catalog';

export type Season = TMDBSeason;

export interface AvailabilitySummary {
  configured: boolean;
  error: string | null;
}

/**
 * One season of a TV result, with the availability question already answered:
 * regular seasons only (specials are not requestable), in season order, each
 * row saying whether Jellyfin already has it. Callers render rows; they do not
 * filter seasons or intersect season sets themselves.
 */
export interface SeasonRow {
  season: Season;
  available: boolean;
}

export interface AvailabilityProjection {
  onJellyfin: boolean;
  seasonRows: SeasonRow[];
}

export function summarizeAvailability(results: Record<number, AvailabilityResult>): AvailabilitySummary {
  const values = Object.values(results);
  return {
    configured: values.length === 0 || values.every((result) => result.configured),
    error: values.find((result) => result.error)?.error ?? null,
  };
}

export function projectAvailability(
  availability: AvailabilityResult | undefined,
  seasons: SeasonsResult | undefined,
  allSeasons: Season[] = [],
): AvailabilityProjection {
  const availableSeasons = seasons?.seasons.filter((season) => season > 0) ?? [];
  const seasonRows = allSeasons
    .filter((season) => season.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .map<SeasonRow>((season) => ({
      season,
      available: availableSeasons.includes(season.season_number),
    }));

  return {
    onJellyfin: availability?.available ?? false,
    seasonRows,
  };
}
