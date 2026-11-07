import { isTerminalStatus, jobStatusLabel, syncRunLabel } from '../status';

describe('job status projection', () => {
  it.each([
    ['pending', 'Queued'],
    ['processing', 'Running'],
    ['completed', 'Completed'],
    ['failed', 'Failed'],
  ] as const)('labels %s as %s', (status, label) => {
    expect(jobStatusLabel(status)).toBe(label);
  });

  it.each([
    ['pending', 'Sync queued'],
    ['processing', 'Syncing'],
    ['completed', 'Sync complete'],
    ['failed', 'Sync failed'],
  ] as const)('maps the sync projection for %s to %s', (status, label) => {
    expect(syncRunLabel(status)).toBe(label);
  });

  it.each([
    ['pending', false],
    ['processing', false],
    ['completed', true],
    ['failed', true],
  ] as const)('reports terminal status for %s', (status, terminal) => {
    expect(isTerminalStatus(status)).toBe(terminal);
  });
});
