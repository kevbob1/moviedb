import { createJellyfinCatalog, JellyfinCatalog, AvailabilityResult, SeasonsResult, PingResult } from './catalog';
import { HttpJellyfinAdapter, InMemoryJellyfinAdapter, JellyfinAdapter, JellyfinCatalogData } from './adapter';

export type { JellyfinCatalog, JellyfinAdapter, JellyfinCatalogData, AvailabilityResult, SeasonsResult, PingResult };
export { createJellyfinCatalog, HttpJellyfinAdapter, InMemoryJellyfinAdapter };

const defaultCatalog = createJellyfinCatalog(new HttpJellyfinAdapter());

export const isOnJellyfin = (id: number) => defaultCatalog.isOnJellyfin(id);
export const seasonsFor = (id: number) => defaultCatalog.seasonsFor(id);
export const availabilityFor = (ids: number[]) => defaultCatalog.availabilityFor(ids);
export const seasonsForMany = (ids: number[]) => defaultCatalog.seasonsForMany(ids);
export const ping = () => defaultCatalog.ping();
