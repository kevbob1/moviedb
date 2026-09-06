import { mapTransmissionSyncStatus } from './transmission-sync-status';

describe('mapTransmissionSyncStatus', () => {
  it.each([
    ['pending', 'Sync queued'],
    ['processing', 'Syncing'],
    ['completed', 'Sync complete'],
    ['failed', 'Sync failed'],
  ] as const)('maps %s to %s', (status, label) => {
    expect(mapTransmissionSyncStatus(status)).toBe(label);
  });
});
