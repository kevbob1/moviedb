import { render, screen, fireEvent } from '@testing-library/react';
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
  requested_at: '2023-06-01T00:00:00Z',
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

  it('calls handlers on button clicks', () => {
    render(<RequestCard request={mockRequest} {...mockHandlers} />);
    fireEvent.click(screen.getByText('Mark Fulfilled'));
    expect(mockHandlers.onMarkFulfilled).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Start Download'));
    expect(mockHandlers.onDownload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockHandlers.onCancel).toHaveBeenCalledTimes(1);
  });
});
