import { TransmissionAdapter, Torrent } from './adapter';

export interface TransmissionCatalog {
  getAll(): Promise<Torrent[]>;
  refresh(): void;
}

const DEFAULT_TTL_MS = 30_000;

export function createTransmissionCatalog(
  adapter: TransmissionAdapter,
  opts?: { ttlMs?: number }
): TransmissionCatalog {
  const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;

  let cached: Torrent[] | null = null;
  let cachedAt = 0;

  return {
    async getAll() {
      const now = Date.now();
      if (cached && now - cachedAt < ttlMs) return cached;
      cached = await adapter.getTorrents();
      cachedAt = now;
      return cached;
    },

    refresh() {
      cached = null;
      cachedAt = 0;
    },
  };
}
