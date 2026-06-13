export interface JellyfinCatalogData {
  movies: Set<string>;
  seasons: Map<string, Set<number>>;
  error?: string;
}

export interface JellyfinAdapter {
  fetchCatalog(): Promise<JellyfinCatalogData>;
  ping(): Promise<{ reachable: boolean; error?: string }>;
}

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

export class HttpJellyfinAdapter implements JellyfinAdapter {
  private readonly url: string;
  private readonly apiKey: string;

  constructor(opts?: { url?: string; apiKey?: string }) {
    this.url = opts?.url ?? process.env.JELLYFIN_URL ?? '';
    this.apiKey = opts?.apiKey ?? process.env.JELLYFIN_API_KEY ?? '';
  }

  async fetchCatalog(): Promise<JellyfinCatalogData> {
    const movies = new Set<string>();
    const seasons = new Map<string, Set<number>>();

    if (!this.url || !this.apiKey) {
      return { movies, seasons, error: 'Jellyfin not configured' };
    }

    const limit = 500;
    let startIndex = 0;

    try {
      while (true) {
        const endpoint = `/Items?IncludeItemTypes=Movie,Season&Recursive=true&Fields=ProviderIds,IndexNumber&Limit=${limit}&StartIndex=${startIndex}`;
        const response = await fetch(`${this.url}${endpoint}`, {
          headers: { 'Authorization': `MediaBrowser Token="${this.apiKey}"` },
        });

        if (!response.ok) {
          return {
            movies,
            seasons,
            error: `Jellyfin API error: ${response.status} ${response.statusText}`,
          };
        }

        const data: JellyfinItemsResponse = await response.json();
        const items = data.Items || [];

        // `movies` holds every TMDB ID present in Jellyfin (movies OR seasons),
        // matching the existing `isOnJellyfin` semantics.
        for (const item of items) {
          const tmdbId = item.ProviderIds?.Tmdb;
          if (!tmdbId) continue;
          movies.add(tmdbId);
          if (item.IndexNumber !== undefined) {
            if (!seasons.has(tmdbId)) seasons.set(tmdbId, new Set());
            seasons.get(tmdbId)!.add(item.IndexNumber);
          }
        }

        const total = data.TotalRecordCount || 0;
        startIndex += limit;
        if (startIndex >= total || items.length === 0) break;
      }

      return { movies, seasons };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      return { movies, seasons, error: `Jellyfin connection failed: ${errorMessage}` };
    }
  }

  async ping(): Promise<{ reachable: boolean; error?: string }> {
    if (!this.url || !this.apiKey) {
      return { reachable: false, error: 'Jellyfin not configured' };
    }

    try {
      const response = await fetch(`${this.url}/System/Info`, {
        headers: { 'Authorization': `MediaBrowser Token="${this.apiKey}"` },
      });

      if (!response.ok) {
        return {
          reachable: false,
          error: `Jellyfin API error: ${response.status} ${response.statusText}`,
        };
      }

      return { reachable: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      return { reachable: false, error: `Jellyfin connection failed: ${errorMessage}` };
    }
  }
}
