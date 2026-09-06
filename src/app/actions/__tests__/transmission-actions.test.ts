import { revalidatePath } from 'next/cache';

import { enqueueTransmissionSync } from '@/lib/jobs/transmission-sync';
import { syncTransmission } from '../transmission-actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/jobs/transmission-sync', () => ({
  enqueueTransmissionSync: jest.fn(),
}));

const enqueueMock = jest.mocked(enqueueTransmissionSync);
const revalidatePathMock = jest.mocked(revalidatePath);

describe('syncTransmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues a manual sync, revalidates needs-match, and returns its status', async () => {
    enqueueMock.mockResolvedValue({ queued: true, status: 'pending', createdAt: '2026-09-05T11:00:00.000Z' });

    await expect(syncTransmission()).resolves.toEqual({
      queued: true,
      status: 'pending',
      createdAt: '2026-09-05T11:00:00.000Z',
    });

    expect(enqueueMock).toHaveBeenCalledWith({ trigger: 'manual' });
    expect(revalidatePathMock).toHaveBeenCalledWith('/needs-match');
  });

  it('returns an already-active processing status without changing the enqueue result', async () => {
    enqueueMock.mockResolvedValue({ queued: false, status: 'processing', createdAt: '2026-09-05T11:00:00.000Z' });

    await expect(syncTransmission()).resolves.toEqual({
      queued: false,
      status: 'processing',
      createdAt: '2026-09-05T11:00:00.000Z',
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/needs-match');
  });

  it('propagates enqueue errors without revalidating', async () => {
    const error = new Error('enqueue failed');
    enqueueMock.mockRejectedValue(error);

    await expect(syncTransmission()).rejects.toBe(error);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
