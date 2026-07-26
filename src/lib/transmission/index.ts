import { HttpTransmissionAdapter, InMemoryTransmissionAdapter, TransmissionAdapter, Torrent } from './adapter';

export type { TransmissionAdapter, Torrent };
export { HttpTransmissionAdapter, InMemoryTransmissionAdapter };

const defaultAdapter = new HttpTransmissionAdapter();

export const ping = () => defaultAdapter.ping();
export const getTorrents = (hashes: string[]) => defaultAdapter.getTorrents(hashes);
export const getAll = () => defaultAdapter.getAll();
