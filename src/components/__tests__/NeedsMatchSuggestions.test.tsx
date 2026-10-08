import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NeedsMatchSuggestion } from '@/components/NeedsMatchSuggestions';
import { Request } from '@/lib/request-lifecycle';
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

describe('NeedsMatchSuggestion', () => {
  it('refreshes after accepting the single-request suggestion card', async () => {
    render(
      <NeedsMatchSuggestion
        request={createRequest({ suggestion_hash: 'abc123', suggestion_score: 0.83 }) as Request & { suggestion_hash: string }}
        torrents={[createTorrent()]}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Accept suggested match/ }));

    await waitFor(() => expect(linkTorrent).toHaveBeenCalledWith(1, 'abc123'));
    expect(refresh).toHaveBeenCalled();
  });

  it('shows a retryable error after the single-request suggestion fails', async () => {
    jest.mocked(linkTorrent).mockRejectedValueOnce(new Error('failed'));
    render(
      <NeedsMatchSuggestion
        request={createRequest({ suggestion_hash: 'abc123', suggestion_score: 0.83 }) as Request & { suggestion_hash: string }}
        torrents={[createTorrent()]}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Accept suggested match/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to accept suggestion. Please try again.');
    expect(screen.getByRole('button', { name: /Accept suggested match/ })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
