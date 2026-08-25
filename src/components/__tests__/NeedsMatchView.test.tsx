import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NeedsMatchView } from '@/components/NeedsMatchView';
import RequestCard from '@/components/RequestCard';
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

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt as string} />;
  },
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
  it('renders each request once with its release year and inline suggestion', () => {
    render(
      <NeedsMatchView
        requests={[
          createRequest({ suggestion_hash: 'abc123', suggestion_score: 0.83, release_date: '2021-10-22' }),
          createRequest({ id: 2, title: 'Arrival', suggestion_hash: null, release_date: '2016-01-29' }),
        ]}
        torrents={[torrent]}
      />
    );

    expect(screen.getAllByText('Suggested match')).toHaveLength(1);
    expect(screen.getByTitle('Dune.2021.1080p.BluRay.x264')).toBeInTheDocument();
    expect(screen.getByText('(2021)')).toBeInTheDocument();
    expect(screen.getAllByText('Score: 0.83')).toHaveLength(1);
    expect(screen.getByText('Arrival')).toBeInTheDocument();
    expect(screen.getByText('(2016)')).toBeInTheDocument();
    expect(screen.getByText('No match found')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Accept suggested match for Dune: Dune.2021.1080p.BluRay.x264',
      })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('uses the same release-year markup as the request list card', () => {
    const request = createRequest({ release_date: '2024-01-01' });

    render(
      <>
        <RequestCard request={request} />
        <NeedsMatchView requests={[request]} torrents={[]} />
      </>
    );

    const releaseYears = screen.getAllByText('(2024)');
    expect(releaseYears).toHaveLength(2);
    expect(releaseYears[0]).toHaveClass('ml-1', 'text-sm', 'font-normal', 'text-muted-foreground');
    expect(releaseYears[1]).toHaveClass('ml-1', 'text-sm', 'font-normal', 'text-muted-foreground');
    expect(releaseYears[1].className).toBe(releaseYears[0].className);
  });

  it('retains needs-attention details in the same request row', () => {
    render(
      <NeedsMatchView
        requests={[createRequest({ status: 'downloading', torrent_problem: 'Torrent errored' })]}
        torrents={[]}
      />
    );

    expect(screen.getByText('Torrent errored')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByText('No match found')).toBeInTheDocument();
  });

  it('accepts the suggested torrent for the matching request', async () => {
    render(<NeedsMatchView requests={[createRequest({ suggestion_hash: 'abc123' })]} torrents={[torrent]} />);

    await userEvent.click(screen.getByRole('button', { name: /Accept suggested match for Dune/ }));

    await waitFor(() => expect(linkTorrent).toHaveBeenCalledWith(1, 'abc123'));
    expect(refresh).toHaveBeenCalled();
  });
});
