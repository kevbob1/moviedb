import { act, fireEvent, render, screen } from '@testing-library/react';

import { syncTransmission } from '@/app/actions/transmission-actions';
import { useRouter } from 'next/navigation';
import { NeedsMatchSyncControl } from './NeedsMatchSyncControl';

jest.mock('@/app/actions/transmission-actions', () => ({
  syncTransmission: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const syncTransmissionMock = jest.mocked(syncTransmission);
const useRouterMock = jest.mocked(useRouter);

const oldSync = {
  status: 'completed',
  error: null,
  createdAt: '2026-09-05T10:00:00.000Z',
  completedAt: '2026-09-05T10:01:00.000Z',
};

function renderControl(lastSync = oldSync) {
  return render(<NeedsMatchSyncControl lastSync={lastSync} />);
}

describe('NeedsMatchSyncControl', () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useRouterMock.mockReturnValue({
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
      push: jest.fn(),
      refresh,
      replace: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('enqueues through the server action, refreshes immediately, and polls', async () => {
    syncTransmissionMock.mockResolvedValue({
      queued: true,
      status: 'pending',
      createdAt: '2026-09-05T11:00:00.000Z',
    });
    renderControl();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    });

    expect(syncTransmissionMock).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Sync queued')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync now/ })).toBeDisabled();

    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('distinguishes an already-active sync', async () => {
    syncTransmissionMock.mockResolvedValue({
      queued: false,
      status: 'processing',
      createdAt: '2026-09-05T11:00:00.000Z',
    });
    renderControl();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    });

    expect(screen.getByText('Syncing')).toBeInTheDocument();
  });

  it.each(['completed', 'failed'] as const)('stops polling when the requested job is %s', async (status) => {
    syncTransmissionMock.mockResolvedValue({
      queued: true,
      status: 'pending',
      createdAt: '2026-09-05T11:00:00.000Z',
    });
    const { rerender } = renderControl();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    });
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });

    rerender(
      <NeedsMatchSyncControl
        lastSync={{
          status,
          error: status === 'failed' ? 'Transmission unavailable' : null,
          createdAt: '2026-09-05T11:00:00.000Z',
          completedAt: status === 'completed' ? '2026-09-05T11:01:00.000Z' : null,
        }}
      />
    );
    expect(screen.getByText(status === 'completed' ? 'Sync complete' : 'Sync failed')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: /Sync now/ })).toBeEnabled();
  });

  it.each(['completed', 'failed'] as const)('returns to idle after a terminal %s job so a later job does not restart polling', async (terminalStatus) => {
    syncTransmissionMock
      .mockResolvedValueOnce({
        queued: true,
        status: 'pending',
        createdAt: '2026-09-05T11:00:00.000Z',
      })
      .mockResolvedValueOnce({
        queued: true,
        status: 'pending',
        createdAt: '2026-09-05T12:00:00.000Z',
      });
    const { rerender } = renderControl();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    });
    rerender(
      <NeedsMatchSyncControl
        lastSync={{
          status: terminalStatus,
          error: terminalStatus === 'failed' ? 'Transmission unavailable' : null,
          createdAt: '2026-09-05T11:00:00.000Z',
          completedAt: terminalStatus === 'completed' ? '2026-09-05T11:01:00.000Z' : null,
        }}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Sync now/ })).toBeEnabled();

    rerender(
      <NeedsMatchSyncControl
        lastSync={{
          status: 'pending',
          error: null,
          createdAt: '2026-09-05T11:30:00.000Z',
          completedAt: null,
        }}
      />
    );
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    });
    expect(syncTransmissionMock).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: /Sync now/ })).toBeDisabled();
  });

  it('does not stop on stale terminal props and times out without inventing failure', async () => {
    syncTransmissionMock.mockResolvedValue({
      queued: true,
      status: 'pending',
      createdAt: '2026-09-05T11:00:00.000Z',
    });
    renderControl();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    });
    await act(async () => {
      jest.advanceTimersByTime(75_000);
    });

    expect(refresh).toHaveBeenCalledTimes(16);
    expect(screen.getByText('Sync queued')).toBeInTheDocument();
    expect(screen.queryByText('Sync failed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync now/ })).toBeEnabled();
  });

  it('suppresses duplicate clicks and reports enqueue errors', async () => {
    syncTransmissionMock.mockRejectedValue(new Error('enqueue failed'));
    renderControl();
    const button = screen.getByRole('button', { name: 'Sync now' });

    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(syncTransmissionMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Sync failed: enqueue failed')).toBeInTheDocument();
    expect(button).toBeEnabled();
  });
});
