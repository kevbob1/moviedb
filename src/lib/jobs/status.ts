import type { JobStatus } from './contracts';

const STATUS_LABELS = {
  pending: 'Queued',
  processing: 'Running',
  completed: 'Completed',
  failed: 'Failed',
} as const;

/**
 * The sync UI keeps its own wording, composed onto the same status set: the
 * four literals live here, in the module that owns the enum, and nowhere else.
 */
const SYNC_LABELS = {
  pending: 'Sync queued',
  processing: 'Syncing',
  completed: 'Sync complete',
  failed: 'Sync failed',
} as const;

export function jobStatusLabel(status: JobStatus): string {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? 'Status unavailable';
}

export function syncRunLabel(status: JobStatus): string {
  return SYNC_LABELS[status as keyof typeof SYNC_LABELS] ?? 'Sync status unavailable';
}

export function isTerminalStatus(status: JobStatus): boolean {
  return status === 'completed' || status === 'failed';
}
