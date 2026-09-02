import { HttpTransmissionAdapter, InMemoryTransmissionAdapter, TransmissionAdapter, Torrent } from './adapter';
import { createTransmissionCatalog, TransmissionCatalog } from './catalog';

export type { TransmissionAdapter, Torrent, TransmissionCatalog };
export { HttpTransmissionAdapter, InMemoryTransmissionAdapter, createTransmissionCatalog };

const defaultAdapter = new HttpTransmissionAdapter();
const defaultCatalog = createTransmissionCatalog(defaultAdapter);

export const getAll = () => defaultCatalog.getAll();
export const refreshCatalog = () => defaultCatalog.refresh();
export const ping = () => defaultAdapter.ping();
export const getTorrents = (hashes?: string[]) => defaultAdapter.getTorrents(hashes);
