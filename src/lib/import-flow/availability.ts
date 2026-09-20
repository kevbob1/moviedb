import { TMDBSeason } from '@/lib/tmdb';
import { AvailabilityResult, SeasonsResult } from '@/lib/jellyfin/catalog';

export type Season = TMDBSeason;

export interface AvailabilitySummary {
  configured: boolean;
  error: string | null;
}

export interface AvailabilityProjection {
  onJellyfin: boolean;
  availableSeasons: number[];
  missingSeasons: number[];
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
  const regularSeasons = allSeasons.filter((season) => season.season_number > 0);
  const availableSeasons = seasons?.seasons.filter((season) => season > 0) ?? [];
  return {
    onJellyfin: availability?.available ?? false,
    availableSeasons,
    missingSeasons: regularSeasons
      .map((season) => season.season_number)
      .filter((seasonNumber) => !availableSeasons.includes(seasonNumber)),
  };
}
