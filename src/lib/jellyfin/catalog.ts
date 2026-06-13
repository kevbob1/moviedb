import { JellyfinAdapter, JellyfinCatalogData } from './adapter';

export interface AvailabilityResult {
  available: boolean;
  configured: boolean;
  error?: string;
}

export interface SeasonsResult {
  seasons: number[];
  configured: boolean;
  error?: string;
}

export interface PingResult {
  configured: boolean;
  reachable: boolean;
  error?: string;
}

export interface JellyfinCatalog {
  isOnJellyfin(tmdbId: number): Promise<AvailabilityResult>;
  seasonsFor(tmdbId: number): Promise<SeasonsResult>;
  availabilityFor(tmdbIds: number[]): Promise<Record<number, AvailabilityResult>>;
  seasonsForMany(tmdbIds: number[]): Promise<Record<number, SeasonsResult>>;
  ping(): Promise<PingResult>;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function createJellyfinCatalog(
  adapter: JellyfinAdapter,
  opts?: { ttlMs?: number }
): JellyfinCatalog {
  const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;

  let cached: JellyfinCatalogData | null = null;
  let cachedAt = 0;

  async function getData(): Promise<JellyfinCatalogData> {
    const now = Date.now();
    if (cached && now - cachedAt < ttlMs) return cached;
    cached = await adapter.fetchCatalog();
    cachedAt = now;
    return cached;
  }

  function isConfigured(data: JellyfinCatalogData): boolean {
    return !data.error;
  }

  function configError(data: JellyfinCatalogData): string | undefined {
    return isConfigured(data) ? undefined : data.error;
  }

  return {
    async isOnJellyfin(tmdbId) {
      const data = await getData();
      return {
        available: data.movies.has(String(tmdbId)),
        configured: isConfigured(data),
        ...(configError(data) ? { error: configError(data) } : {}),
      };
    },

    async seasonsFor(tmdbId) {
      const data = await getData();
      const set = data.seasons.get(String(tmdbId));
      return {
        seasons: set ? Array.from(set).sort((a, b) => a - b) : [],
        configured: isConfigured(data),
        ...(configError(data) ? { error: configError(data) } : {}),
      };
    },

    async availabilityFor(tmdbIds) {
      const data = await getData();
      const errMsg = configError(data);
      const result: Record<number, AvailabilityResult> = {};
      for (const id of tmdbIds) {
        result[id] = {
          available: data.movies.has(String(id)),
          configured: isConfigured(data),
          ...(errMsg ? { error: errMsg } : {}),
        };
      }
      return result;
    },

    async seasonsForMany(tmdbIds) {
      const data = await getData();
      const errMsg = configError(data);
      const result: Record<number, SeasonsResult> = {};
      for (const id of tmdbIds) {
        const set = data.seasons.get(String(id));
        result[id] = {
          seasons: set ? Array.from(set).sort((a, b) => a - b) : [],
          configured: isConfigured(data),
          ...(errMsg ? { error: errMsg } : {}),
        };
      }
      return result;
    },

    async ping() {
      const data = await getData();
      const pingResult = await adapter.ping();
      if (!isConfigured(data)) {
        return { configured: false, reachable: false, error: data.error };
      }
      return { configured: true, reachable: pingResult.reachable, ...(pingResult.error ? { error: pingResult.error } : {}) };
    },
  };
}
