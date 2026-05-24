interface JellyfinItemsResponse {
  Items?: unknown;
}

async function queryJellyfinItems(endpoint: string): Promise<JellyfinItemsResponse | null> {
  const jellyfinUrl = process.env.JELLYFIN_URL || "";
  const jellyfinApiKey = process.env.JELLYFIN_API_KEY || "";

  if (!jellyfinUrl || !jellyfinApiKey) {
    return null;
  }

  try {
    const response = await fetch(`${jellyfinUrl}${endpoint}`, {
      headers: {
        'Authorization': `MediaBrowser Token="${jellyfinApiKey}"`
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

export async function isMovieOnJellyfin(tmdbId: number): Promise<boolean> {
  if (!tmdbId) {
    return false;
  }

  const data = await queryJellyfinItems(
    `/Items?AnyProviderIdEquals=tmdb.${tmdbId}&IncludeItemTypes=Movie`
  );

  return (data?.Items as unknown[])?.length > 0 || false;
}

export async function areMoviesOnJellyfin(tmdbIds: number[]): Promise<Map<number, boolean>> {
  const result = new Map<number, boolean>();
  const jellyfinUrl = process.env.JELLYFIN_URL || "";
  const jellyfinApiKey = process.env.JELLYFIN_API_KEY || "";

  if (!tmdbIds?.length) {
    return result;
  }

  // Initialize all as false
  tmdbIds.forEach(id => result.set(id, false));

  if (!jellyfinUrl || !jellyfinApiKey) {
    return result;
  }

  // Build provider filter: tmdb.123|tmdb.456|tmdb.789
  const anyProviderIdEquals = tmdbIds.map(id => `tmdb.${id}`).join('|');

  const data = await queryJellyfinItems(
    `/Items?AnyProviderIdEquals=${anyProviderIdEquals}&IncludeItemTypes=Movie`
  );

  if (data?.Items) {
    const items = data.Items as unknown[];
    items.forEach((item) => {
      if (item && typeof item === 'object' && 'ProviderIds' in item) {
        const providerIds = (item as { ProviderIds?: { tmdb?: string } }).ProviderIds;
        const tmdbId = providerIds?.tmdb;
        if (tmdbId && result.has(parseInt(tmdbId, 10))) {
          result.set(parseInt(tmdbId, 10), true);
        }
      }
    });
  }

  return result;
}
