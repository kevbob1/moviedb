async function queryJellyfinItems(endpoint: string): Promise<any | null> {
  const JELLYFIN_URL = process.env.JELLYFIN_URL || "";
  const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY || "";
  
  if (!JELLYFIN_URL || !JELLYFIN_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${JELLYFIN_URL}${endpoint}`, {
      headers: {
        'Authorization': `MediaBrowser Token="${JELLYFIN_API_KEY}"`
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
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

  return data?.Items?.length > 0 || false;
}

export async function areMoviesOnJellyfin(tmdbIds: number[]): Promise<Map<number, boolean>> {
  const result = new Map<number, boolean>();

  if (!tmdbIds?.length) {
    return result;
  }

  tmdbIds.forEach(id => result.set(id, false));

  const JELLYFIN_URL = process.env.JELLYFIN_URL || "";
  const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY || "";

  if (!JELLYFIN_URL || !JELLYFIN_API_KEY) {
    return result;
  }

  const anyProviderIdEquals = tmdbIds.map(id => `tmdb.${id}`).join('|');

  const data = await queryJellyfinItems(
    `/Items?AnyProviderIdEquals=${anyProviderIdEquals}&IncludeItemTypes=Movie`
  );

  if (data?.Items?.length > 0) {
    data.Items.forEach((item: any) => {
      const tmdbId = item.ProviderIds?.tmdb;
      if (tmdbId && result.has(parseInt(tmdbId, 10))) {
        result.set(parseInt(tmdbId, 10), true);
      }
    });
  }

  return result;
}
