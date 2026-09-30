import { HttpTransmissionAdapter } from './adapter';
import { createTransmissionCatalog } from './catalog';

const defaultAdapter = new HttpTransmissionAdapter();
const defaultCatalog = createTransmissionCatalog(defaultAdapter);

export const getAll = () => defaultCatalog.getAll();
export const ping = () => defaultAdapter.ping();
