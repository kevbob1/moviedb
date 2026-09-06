import { act, fireEvent, render, screen } from '@testing-library/react';

import { syncTransmission } from '@/app/actions/transmission-actions';
import { readNeedsMatch } from '@/lib/needs-match/read';
import NeedsMatchPage, { dynamic } from './page';

jest.mock('@/app/actions/transmission-actions', () => ({
  syncTransmission: jest.fn(),
}));

jest.mock('@/lib/needs-match/read', () => ({
  readNeedsMatch: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    refresh: jest.fn(),
  })),
}));

const syncTransmissionMock = jest.mocked(syncTransmission);
const readNeedsMatchMock = jest.mocked(readNeedsMatch);

describe('NeedsMatchPage', () => {
  it('renders dynamically because it reads from the database', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    readNeedsMatchMock.mockResolvedValue({
      requests: [],
      needsAttention: [],
      torrents: [],
      transmissionError: null,
      transmissionState: 'ok',
      torrentCount: 0,
      lastSync: null,
    });
  });

  it('renders and wires the sync control when there are no requests', async () => {
    syncTransmissionMock.mockResolvedValue({
      queued: true,
      status: 'pending',
      createdAt: '2026-09-05T11:00:00.000Z',
    });

    render(await NeedsMatchPage());

    expect(screen.getByText('All requests have been matched')).toBeInTheDocument();
    const syncButton = screen.getByRole('button', { name: 'Sync now' });
    expect(syncButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(syncButton);
    });

    expect(syncTransmissionMock).toHaveBeenCalledTimes(1);
  });
});
