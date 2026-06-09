import { render, screen, fireEvent } from '@testing-library/react';
import { RequestListItem } from '../RequestListItem';
import { Request } from '@/types/request';
import * as genres from '@/lib/genres';
import * as requestActions from '@/app/actions/request-actions';

jest.mock('@/lib/genres');
jest.mock('@/app/actions/request-actions');

const mockRequest = {
  id: 1,
  title: 'Test Movie',
  overview: 'A test movie',
  release_date: '2024-01-01',
  genre_ids: [28, 12],
  poster_path: '/test.jpg',
  requested_by: 'John Doe',
  requested_at: '2024-01-01T00:00:00Z',
  status: 'pending' as const,
  tmdb_id: 123,
  media_type: 'movie',
};

describe('RequestListItem', () => {
  beforeEach(() => {
    (genres.getGenreNames as jest.Mock).mockReturnValue(['Action', 'Adventure']);
  });

  it('renders request title and poster', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('test.jpg'));
  });

  it('renders status badge with correct color for pending', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    expect(screen.getByText('Pending')).toHaveClass('text-status-pending-text', 'bg-status-pending-bg');
  });

  it('renders status badge with correct color for downloading', () => {
    const downloadingRequest = { ...mockRequest, status: 'downloading' as const, tmdb_id: 123, media_type: 'movie' };
    render(<RequestListItem request={downloadingRequest} jellyfinAvailable={false} />);
    expect(screen.getByText('Downloading')).toHaveClass('text-status-downloading-text', 'bg-status-downloading-bg');
  });

  it('renders no action buttons for fulfilled status', () => {
    const fulfilledRequest = { ...mockRequest, status: 'fulfilled' as const, tmdb_id: 123, media_type: 'movie' };
    render(<RequestListItem request={fulfilledRequest} jellyfinAvailable={false} />);
    expect(screen.queryByText('Start Download')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark Fulfilled')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('marks fulfilled calls fulfillRequest not cancelRequest', async () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    const fulfillButton = screen.getByText('Mark Fulfilled');
    fireEvent.click(fulfillButton);
    expect(requestActions.fulfillRequest).toHaveBeenCalledWith(1);
    expect(requestActions.cancelRequest).not.toHaveBeenCalled();
  });

  it('renders release year next to title', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    expect(screen.getByText('(2024)')).toBeInTheDocument();
  });

  it('renders overview description', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    expect(screen.getByText('A test movie')).toBeInTheDocument();
  });

  it('renders genres from genre_ids', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    expect(screen.getByText('Action, Adventure')).toBeInTheDocument();
  });

  it('renders cancel button in red', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toHaveClass('bg-red-600');
  });

  it('renders start download button in blue', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    const downloadButton = screen.getByText('Start Download');
    expect(downloadButton).toHaveClass('bg-blue-600');
  });

  it('renders mark fulfilled button in green', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    const fulfillButton = screen.getByText('Mark Fulfilled');
    expect(fulfillButton).toHaveClass('bg-green-600');
  });

  it('shows TV badge and season for TV requests', () => {
    const tvRequest: Request = {
      id: 1,
      title: 'Best Show',
      tmdb_id: 100,
      season_number: 3,
      media_type: 'tv',
      requested_by: 'Alice',
      requested_at: '2026-01-01',
      status: 'pending',
    };
    render(<RequestListItem request={tvRequest} />);
    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText(/Season 3/)).toBeInTheDocument();
  });
});
