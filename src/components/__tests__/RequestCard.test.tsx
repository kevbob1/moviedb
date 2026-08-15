import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RequestCard from '../RequestCard';
import { RequestStatus } from '@/lib/request-lifecycle/fsm';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt as string} />;
  },
}));

jest.mock('@/app/actions/request-actions', () => ({
  fulfillRequest: jest.fn().mockResolvedValue(undefined),
  downloadRequest: jest.fn().mockResolvedValue(undefined),
  cancelRequest: jest.fn().mockResolvedValue(undefined),
}));

import { cancelRequest, downloadRequest, fulfillRequest } from '@/app/actions/request-actions';

const mockRequest = {
  id: 1,
  title: 'Test Movie',
  tmdb_id: 123,
  poster_path: '/test.jpg',
  overview: 'A test movie',
  release_date: '2023-01-01',
  genre_ids: [28, 35],
  requested_by: 'Alice',
  requested_at: '2023-06-01T00:00:00Z',
  status: 'pending' as RequestStatus,
  media_type: 'movie',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RequestCard', () => {
  it('renders title and status', () => {
    render(<RequestCard request={mockRequest} />);
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders action buttons for pending status (no cancel in actions)', () => {
    render(<RequestCard request={mockRequest} />);
    expect(screen.getByText('Mark Fulfilled')).toBeInTheDocument();
    expect(screen.getByText('Start Download')).toBeInTheDocument();
  });

  it('renders Cancel button separately for non-fulfilled status', () => {
    render(<RequestCard request={mockRequest} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not render Cancel button for fulfilled status', () => {
    const fulfilledRequest = { ...mockRequest, status: 'fulfilled' as RequestStatus };
    render(<RequestCard request={fulfilledRequest} />);
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('calls the action on Mark Fulfilled', async () => {
    render(<RequestCard request={mockRequest} />);
    fireEvent.click(screen.getByText('Mark Fulfilled'));
    await waitFor(() => expect(fulfillRequest).toHaveBeenCalledWith(1));
  });

  it('calls the action on Start Download', async () => {
    render(<RequestCard request={mockRequest} />);
    fireEvent.click(screen.getByText('Start Download'));
    await waitFor(() => expect(downloadRequest).toHaveBeenCalledWith(1));
  });

  it('calls the action on Cancel', async () => {
    render(<RequestCard request={mockRequest} />);
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(cancelRequest).toHaveBeenCalledWith(1));
  });

  it('invokes onAfterCancel after a successful cancel', async () => {
    const onAfterCancel = jest.fn();
    render(<RequestCard request={mockRequest} onAfterCancel={onAfterCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(onAfterCancel).toHaveBeenCalledTimes(1));
  });

  it('invokes onAfter after a successful fulfill', async () => {
    const onAfter = jest.fn();
    render(<RequestCard request={mockRequest} onAfter={onAfter} />);
    fireEvent.click(screen.getByText('Mark Fulfilled'));
    await waitFor(() => expect(onAfter).toHaveBeenCalledTimes(1));
  });

  it('renders jellyfin available indicator', () => {
    render(<RequestCard request={mockRequest} jellyfinAvailable />);
    expect(screen.getByText('On Jellyfin')).toBeInTheDocument();
  });

  it('renders TV badge and season number', () => {
    const tvRequest = { ...mockRequest, title: 'Test Show', media_type: 'tv', season_number: 2 };
    render(<RequestCard request={tvRequest} />);
    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText(/S2/)).toBeInTheDocument();
  });

  it('renders poster image', () => {
    render(<RequestCard request={mockRequest} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('test.jpg'));
    expect(img).toHaveAttribute('alt', 'Test Movie');
  });
});