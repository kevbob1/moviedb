import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NeedsMatchSuggestion } from '@/components/NeedsMatchSuggestions';
import { Request } from '@/lib/request-lifecycle';
import type { MatchSuggestion } from '@/lib/needs-match/read';

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

const createSuggestion = (overrides: Partial<MatchSuggestion> = {}): MatchSuggestion => ({
  hash: 'abc123',
  name: 'Dune.2021.1080p.BluRay.x264',
  score: 0.83,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NeedsMatchSuggestion', () => {
  it('refreshes after accepting the single-request suggestion card', async () => {
    render(<NeedsMatchSuggestion request={createRequest()} suggestion={createSuggestion()} />);

    await userEvent.click(screen.getByRole('button', { name: /Accept suggested match/ }));

    await waitFor(() => expect(linkTorrent).toHaveBeenCalledWith(1, 'abc123'));
    expect(refresh).toHaveBeenCalled();
  });

  it('shows a retryable error after the single-request suggestion fails', async () => {
    jest.mocked(linkTorrent).mockRejectedValueOnce(new Error('failed'));
    render(<NeedsMatchSuggestion request={createRequest()} suggestion={createSuggestion()} />);

    await userEvent.click(screen.getByRole('button', { name: /Accept suggested match/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to accept suggestion. Please try again.');
    expect(screen.getByRole('button', { name: /Accept suggested match/ })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('renders the embedded suggestion name and score', () => {
    render(<NeedsMatchSuggestion request={createRequest()} suggestion={createSuggestion({ name: 'Embedded.Torrent.Name' })} />);

    expect(screen.getByTitle('Embedded.Torrent.Name')).toHaveTextContent('Embedded.Torrent.Name');
    expect(screen.getByText('Score: 0.83')).toBeInTheDocument();
  });

  it.each([
    [0.9, 'border-emerald-500'],
    [0.89, 'border-amber-500'],
    [0.6, 'border-amber-500'],
    [0.5, 'border-amber-500'],
    [0.49, 'border-rose-500'],
  ])('colours a %s score with the %s band', (score, borderClass) => {
    render(<NeedsMatchSuggestion request={createRequest()} suggestion={createSuggestion({ score })} />);

    expect(screen.getByRole('status')).toHaveClass(borderClass);
  });
});
