import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NeedsMatchSuggestions } from '@/components/NeedsMatchSuggestions';
import { Request } from '@/types/request';
import { Torrent } from '@/lib/transmission/adapter';

jest.mock('@/app/actions/request-actions', () => ({
  linkTorrent: jest.fn().mockResolvedValue(undefined),
}));

const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh,
  }),
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

const createTorrent = (overrides: Partial<Torrent> = {}): Torrent => ({
  hash: 'abc123',
  name: 'Dune.2021.1080p.BluRay.x264',
  percentDone: 0,
  status: 0,
  ...overrides,
} as Torrent);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NeedsMatchSuggestions', () => {
  it('renders nothing when there are no suggestions', () => {
    const { container } = render(
      <NeedsMatchSuggestions
        requests={[createRequest({ suggestion_hash: null, suggestion_score: null })]}
        torrents={[createTorrent()]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a suggestion card with title, torrent name, score, and Accept button', () => {
    render(
      <NeedsMatchSuggestions
        requests={[createRequest({ suggestion_hash: 'abc123', suggestion_score: 0.83 })]}
        torrents={[createTorrent()]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Suggestions' })).toBeInTheDocument();
    expect(screen.getByText('Dune')).toBeInTheDocument();
    expect(screen.getByText('Dune.2021.1080p.BluRay.x264')).toBeInTheDocument();
    expect(screen.getByText('Score: 0.83')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: "Link 'Dune' to torrent 'Dune.2021.1080p.BluRay.x264' — 0.83 confidence",
      })
    ).toBeInTheDocument();
  });

  it('renders season number when present', () => {
    render(
      <NeedsMatchSuggestions
        requests={[
          createRequest({
            title: 'Dune: Prophecy',
            season_number: 1,
            suggestion_hash: 'abc123',
            suggestion_score: 0.75,
          }),
        ]}
        torrents={[createTorrent()]}
      />
    );

    expect(screen.getByText('Season 1')).toBeInTheDocument();
  });

  it('falls back to the hash when the torrent is not found', () => {
    render(
      <NeedsMatchSuggestions
        requests={[createRequest({ suggestion_hash: 'missing-hash', suggestion_score: 0.65 })]}
        torrents={[createTorrent()]}
      />
    );

    expect(screen.getByText('missing-hash')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /missing-hash/ })).toBeInTheDocument();
  });

  it('calls linkTorrent with the right ids and refreshes the router when Accept is clicked', async () => {
    render(
      <NeedsMatchSuggestions
        requests={[createRequest({ suggestion_hash: 'abc123', suggestion_score: 0.83 })]}
        torrents={[createTorrent()]}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: "Link 'Dune' to torrent 'Dune.2021.1080p.BluRay.x264' — 0.83 confidence",
      })
    );

    await waitFor(() => expect(linkTorrent).toHaveBeenCalledWith(1, 'abc123'));
    expect(refresh).toHaveBeenCalled();
  });
});
