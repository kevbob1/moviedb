import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NeedsMatchView } from '@/components/NeedsMatchView';
import { Request } from '@/types/request';
import { Torrent } from '@/lib/transmission/adapter';

jest.mock('@/app/actions/request-actions', () => ({
  linkTorrent: jest.fn().mockResolvedValue(undefined),
  cancelRequest: jest.fn().mockResolvedValue(undefined),
}));

const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

import { linkTorrent } from '@/app/actions/request-actions';

const createRequest = (overrides: Partial<Request> = {}): Request => ({
  id: 1,
  title: 'Dune',
  requested_by: 'user',
  requested_at: '2024-01-01T00:00:00.000Z',
  status: 'pending',
  ...overrides,
});

const torrent: Torrent = {
  hash: 'abc123',
  name: 'Dune.2021.1080p.BluRay.x264',
  percentDone: 0,
  status: 0,
} as Torrent;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NeedsMatchView inline suggestions', () => {
  it('renders the suggestion banner only for requests with a suggestion', () => {
    render(
      <NeedsMatchView
        requests={[
          createRequest({ suggestion_hash: 'abc123', suggestion_score: 0.83 }),
          createRequest({ id: 2, title: 'Arrival', suggestion_hash: null }),
        ]}
        torrents={[torrent]}
      />
    );

    expect(screen.getAllByText('Suggested match')).toHaveLength(1);
    expect(screen.getByText('Score: 0.83')).toBeInTheDocument();
    expect(screen.getByText('Arrival')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Accept suggested match/ })).toHaveLength(1);
  });

  it('accepts the suggested torrent for the matching request', async () => {
    render(<NeedsMatchView requests={[createRequest({ suggestion_hash: 'abc123' })]} torrents={[torrent]} />);

    await userEvent.click(screen.getByRole('button', { name: /Accept suggested match for Dune/ }));

    await waitFor(() => expect(linkTorrent).toHaveBeenCalledWith(1, 'abc123'));
    expect(refresh).toHaveBeenCalled();
  });
});
