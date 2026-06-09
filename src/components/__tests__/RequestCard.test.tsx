import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RequestCard from '../RequestCard';
import { RequestStatus } from '@/lib/request-fsm';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt as string} />;
  },
}));

const mockRequest = {
  id: 1,
  title: 'Test Movie',
  tmdb_id: 123,
  poster_path: '/test.jpg',
  overview: 'A test movie',
  release_date: '2023-01-01',
  genre_ids: [28, 35],
  requested_by: 'Alice',
  requested_at: '6/1/2023',
  status: 'pending' as RequestStatus,
  media_type: 'movie',
};

const mockHandlers = {
  onMarkFulfilled: jest.fn(),
  onDownload: jest.fn(),
  onCancel: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RequestCard', () => {
  it('renders title and status', () => {
    render(<RequestCard request={mockRequest} {...mockHandlers} />);
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders action buttons for pending status', () => {
    render(<RequestCard request={mockRequest} {...mockHandlers} />);
    expect(screen.getByText('Mark Fulfilled')).toBeInTheDocument();
    expect(screen.getByText('Start Download')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls handlers on button clicks', async () => {
    render(<RequestCard request={mockRequest} {...mockHandlers} />);
    fireEvent.click(screen.getByText('Mark Fulfilled'));
    await waitFor(() => expect(screen.getByText('Mark Fulfilled')).toBeInTheDocument());
    expect(mockHandlers.onMarkFulfilled).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Start Download'));
    await waitFor(() => expect(screen.getByText('Start Download')).toBeInTheDocument());
    expect(mockHandlers.onDownload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.getByText('Cancel')).toBeInTheDocument());
    expect(mockHandlers.onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows loading state during async actions', async () => {
    const slowHandler = jest.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
    render(<RequestCard request={mockRequest} {...mockHandlers} onMarkFulfilled={slowHandler} />);
    fireEvent.click(screen.getByText('Mark Fulfilled'));
    expect(screen.getAllByText('Loading...')).toHaveLength(3);
    await waitFor(() => expect(screen.getByText('Mark Fulfilled')).toBeInTheDocument());
  });

  it('renders jellyfin available indicator', () => {
    render(<RequestCard request={mockRequest} {...mockHandlers} jellyfinAvailable />);
    expect(screen.getByText('Available in Jellyfin')).toBeInTheDocument();
  });

  it('renders TV badge and season number', () => {
    const tvRequest = { ...mockRequest, title: 'Test Show', media_type: 'tv', season_number: 2 };
    render(<RequestCard request={tvRequest} {...mockHandlers} />);
    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText(/Season 2/)).toBeInTheDocument();
  });

  it('renders poster image', () => {
    render(<RequestCard request={mockRequest} {...mockHandlers} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('test.jpg'));
    expect(img).toHaveAttribute('alt', 'Test Movie');
  });
});
