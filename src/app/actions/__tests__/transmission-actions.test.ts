import { revalidatePath } from 'next/cache';

import { enqueue } from '@/lib/jobs';
import { syncTransmission } from '../transmission-actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/jobs', () => ({
  enqueue: jest.fn(),
}));

const enqueueMock = jest.mocked(enqueue);
const revalidatePathMock = jest.mocked(revalidatePath);

describe('syncTransmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues a manual sync, revalidates needs-match, and returns its run', async () => {
    const enqueued = {
      queued: true,
      job: { status: 'pending' as const, queuedAt: '2026-09-05T11:00:00.000Z' },
    };
    enqueueMock.mockResolvedValue(enqueued);

    await expect(syncTransmission()).resolves.toEqual(enqueued);

    expect(enqueueMock).toHaveBeenCalledWith('transmission_sync', { trigger: 'manual' });
    expect(revalidatePathMock).toHaveBeenCalledWith('/needs-match');
  });

  it('returns an already-active processing run without changing the enqueue result', async () => {
    const enqueued = {
      queued: false,
      job: { status: 'processing' as const, queuedAt: '2026-09-05T11:00:00.000Z' },
    };
    enqueueMock.mockResolvedValue(enqueued);

    await expect(syncTransmission()).resolves.toEqual(enqueued);
    expect(revalidatePathMock).toHaveBeenCalledWith('/needs-match');
  });

  it('propagates enqueue errors without revalidating', async () => {
    const error = new Error('enqueue failed');
    enqueueMock.mockRejectedValue(error);

    await expect(syncTransmission()).rejects.toBe(error);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
