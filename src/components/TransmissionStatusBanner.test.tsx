import { render, screen } from '@testing-library/react';

import { TransmissionStatusBanner } from './TransmissionStatusBanner';

describe('TransmissionStatusBanner', () => {
  it('presents mapped sync status while preserving connectivity messaging', () => {
    render(
      <TransmissionStatusBanner
        state="ok"
        torrentCount={3}
        lastSync={{
          status: 'completed',
          error: null,
          createdAt: '2026-09-05T10:00:00.000Z',
          completedAt: '2026-09-05T10:01:00.000Z',
        }}
      />
    );

    expect(screen.getByText(/Transmission connected · 3 torrents observed/)).toBeInTheDocument();
    expect(screen.getByText(/Last sync .*Sync complete/)).toBeInTheDocument();
    expect(screen.queryByText(/completed/)).not.toBeInTheDocument();
  });

  it('preserves the transmission error message', () => {
    render(
      <TransmissionStatusBanner
        state="unreachable"
        error="Connection refused"
        torrentCount={null}
        lastSync={null}
      />
    );

    expect(screen.getByText('Transmission problem: Connection refused')).toBeInTheDocument();
    expect(screen.getByText(/Torrent list unavailable/)).toBeInTheDocument();
  });
});
