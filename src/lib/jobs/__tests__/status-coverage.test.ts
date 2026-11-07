import type { JobStatus } from '../contracts';
import { isTerminalStatus, jobStatusLabel, syncRunLabel } from '../status';

describe('job status vocabulary', () => {
  it('labels every known status', () => {
    expect(jobStatusLabel('pending')).toBe('Queued');
    expect(jobStatusLabel('processing')).toBe('Running');
    expect(jobStatusLabel('completed')).toBe('Completed');
    expect(jobStatusLabel('failed')).toBe('Failed');
    expect(syncRunLabel('pending')).toBe('Sync queued');
    expect(syncRunLabel('processing')).toBe('Syncing');
    expect(syncRunLabel('completed')).toBe('Sync complete');
    expect(syncRunLabel('failed')).toBe('Sync failed');
  });

  it('falls back when a row carries a status the enum does not know', () => {
    const unknown = 'mystery' as unknown as JobStatus;

    expect(jobStatusLabel(unknown)).toBe('Status unavailable');
    expect(syncRunLabel(unknown)).toBe('Sync status unavailable');
  });

  it('treats only completed and failed as terminal', () => {
    expect(isTerminalStatus('completed')).toBe(true);
    expect(isTerminalStatus('failed')).toBe(true);
    expect(isTerminalStatus('pending')).toBe(false);
    expect(isTerminalStatus('processing')).toBe(false);
  });
});
