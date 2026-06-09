interface JellyfinItem {
  Name?: string;
  ProviderIds?: { Tmdb?: string; Imdb?: string; [key: string]: string | undefined };
  IndexNumber?: number;
  [key: string]: unknown;
}

interface JellyfinItemsResponse {
  Items?: JellyfinItem[];
  TotalRecordCount?: number;
}

export interface JellyfinAvailabilityResult {
  results: Map<number, boolean>;
  error?: string;
  configured: boolean;
  lastChecked: Date;
}

export interface JellyfinStatus {
  available: boolean;
  error?: string;
  configured: boolean;
}

export interface JellyfinConnectivityResult {
  configured: boolean;
  reachable: boolean;
  error?: string;
}

export interface JellyfinCheckResult {
  results: Record<number, boolean>;
  error?: string;
  configured: boolean;
}

export interface JellyfinSeasonCheckResult {
  seasons: Record<number, number[]>;
  error?: string;
  configured: boolean;
}

let jellyfinTmdbCache: Set<string> | null = null;
let jellyfinSeasonCache: Map<string, Set<number>> | null = null;
let jellyfinCacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getJellyfinTmdbIds(): Promise<{ ids: Set<string>; error?: string }> {
  const now = Date.now();
  if (jellyfinTmdbCache && jellyfinSeasonCache && (now - jellyfinCacheTimestamp) < CACHE_TTL_MS) {
    return { ids: jellyfinTmdbCache };
  }

  const jellyfinUrl = process.env.JELLYFIN_URL || "";
  const jellyfinApiKey = process.env.JELLYFIN_API_KEY || "";

  if (!jellyfinUrl || !jellyfinApiKey) {
    return { ids: new Set(), error: 'Jellyfin not configured' };
  }

  const tmdbIds = new Set<string>();
  let startIndex = 0;
  const limit = 500;

  try {
    while (true) {
      const endpoint = `/Items?IncludeItemTypes=Movie,Season&Recursive=true&Fields=ProviderIds,IndexNumber&Limit=${limit}&StartIndex=${startIndex}`;
      const response = await fetch(`${jellyfinUrl}${endpoint}`, {
        headers: {
          'Authorization': `MediaBrowser Token="${jellyfinApiKey}"`
        }
      });

      if (!response.ok) {
        return { ids: tmdbIds, error: `Jellyfin API error: ${response.status} ${response.statusText}` };
      }

      const data: JellyfinItemsResponse = await response.json();
      const items = data.Items || [];

      for (const item of items) {
        const tmdbId = item.ProviderIds?.Tmdb;
        if (tmdbId) {
          tmdbIds.add(tmdbId);
          if (item.IndexNumber !== undefined) {
            if (!jellyfinSeasonCache) jellyfinSeasonCache = new Map();
            if (!jellyfinSeasonCache.has(tmdbId)) jellyfinSeasonCache.set(tmdbId, new Set());
            jellyfinSeasonCache.get(tmdbId)!.add(item.IndexNumber);
          }
        }
      }

      const total = data.TotalRecordCount || 0;
      startIndex += limit;
      if (startIndex >= total || items.length === 0) break;
    }

    jellyfinTmdbCache = tmdbIds;
    if (!jellyfinSeasonCache) jellyfinSeasonCache = new Map();
    jellyfinCacheTimestamp = now;
    return { ids: tmdbIds };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Network error';
    return { ids: tmdbIds, error: `Jellyfin connection failed: ${errorMessage}` };
  }
}

export function invalidateJellyfinCache(): void {
  jellyfinTmdbCache = null;
  jellyfinSeasonCache = null;
  jellyfinCacheTimestamp = 0;
}

export async function checkJellyfinConnectivity(): Promise<JellyfinConnectivityResult> {
  const jellyfinUrl = process.env.JELLYFIN_URL || '';
  const jellyfinApiKey = process.env.JELLYFIN_API_KEY || '';

  if (!jellyfinUrl || !jellyfinApiKey) {
    return { configured: false, reachable: false, error: 'Jellyfin not configured' };
  }

  try {
    const response = await fetch(`${jellyfinUrl}/System/Info`, {
      headers: {
        'Authorization': `MediaBrowser Token="${jellyfinApiKey}"`
      }
    });

    if (!response.ok) {
      return { configured: true, reachable: false, error: `Jellyfin API error: ${response.status} ${response.statusText}` };
    }

    return { configured: true, reachable: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Network error';
    return { configured: true, reachable: false, error: `Jellyfin connection failed: ${errorMessage}` };
  }
}

export async function checkMovieOnJellyfin(tmdbId: number): Promise<JellyfinCheckResult> {
  if (!tmdbId) {
    return { results: {}, configured: false, error: 'Invalid movie ID' };
  }

  const { ids, error } = await getJellyfinTmdbIds();
  const configured = ids.size > 0 || !error;

  return {
    results: { [tmdbId]: ids.has(String(tmdbId)) },
    configured,
    error: ids.size === 0 ? error : undefined
  };
}

export async function checkMoviesOnJellyfin(tmdbIds: number[]): Promise<JellyfinCheckResult> {
  if (!tmdbIds?.length) {
    return { results: {}, configured: false };
  }

  const { ids, error } = await getJellyfinTmdbIds();
  const configured = ids.size > 0 || !error;

  const results: Record<number, boolean> = {};
  for (const id of tmdbIds) {
    results[id] = ids.has(String(id));
  }

  return { results, configured, error: ids.size === 0 ? error : undefined };
}

export async function checkSeasonsOnJellyfin(tmdbIds: number[]): Promise<JellyfinSeasonCheckResult> {
  if (!tmdbIds?.length) {
    return { seasons: {}, configured: false };
  }

  const { ids, error } = await getJellyfinTmdbIds();
  const configured = ids.size > 0 || !error;

  const seasons: Record<number, number[]> = {};
  for (const id of tmdbIds) {
    const key = String(id);
    const seasonSet = jellyfinSeasonCache?.get(key);
    seasons[id] = seasonSet ? Array.from(seasonSet).sort((a, b) => a - b) : [];
  }

  return { seasons, configured, error: !configured ? error : undefined };
}

export async function isMovieOnJellyfin(tmdbId: number): Promise<JellyfinStatus> {
  if (!tmdbId) {
    return { available: false, configured: false, error: 'Invalid movie ID' };
  }

  const { ids, error } = await getJellyfinTmdbIds();
  const configured = ids.size > 0 || !error;

  return {
    available: ids.has(String(tmdbId)),
    configured,
    error: ids.size === 0 ? error : undefined
  };
}

export async function areMoviesOnJellyfin(tmdbIds: number[]): Promise<Map<number, boolean>> {
  const result = new Map<number, boolean>();

  if (!tmdbIds?.length) {
    return result;
  }

  tmdbIds.forEach(id => result.set(id, false));

  const { ids } = await getJellyfinTmdbIds();

  for (const id of tmdbIds) {
    if (ids.has(String(id))) {
      result.set(id, true);
    }
  }

  return result;
}

export async function checkAvailability(tmdbIds: number[]): Promise<JellyfinAvailabilityResult> {
  const result = new Map<number, boolean>();
  let error: string | undefined;
  let configured = true;

  if (!tmdbIds?.length) {
    return { results: result, configured: true, lastChecked: new Date() };
  }

  tmdbIds.forEach(id => result.set(id, false));

  const { ids, error: fetchError } = await getJellyfinTmdbIds();

  if (fetchError) {
    error = fetchError;
    configured = false;
    return { results: result, error, configured, lastChecked: new Date() };
  }

  for (const id of tmdbIds) {
    if (ids.has(String(id))) {
      result.set(id, true);
    }
  }

  return { results: result, configured, lastChecked: new Date() };
}
