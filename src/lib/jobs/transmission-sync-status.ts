const STATUS_LABELS = {
  pending: 'Sync queued',
  processing: 'Syncing',
  completed: 'Sync complete',
  failed: 'Sync failed',
} as const;

export function mapTransmissionSyncStatus(status: string): string {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? 'Sync status unavailable';
}
