import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RequestDetail from '../RequestDetail';
import { RequestStatus } from '@/lib/request-fsm';
import { cancelRequest, fulfillRequest, downloadRequest } from '@/app/actions/request-actions';

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const mockRequest = {
  id: 1,
  title: 'Test Movie',
  tmdb_id: 123,
  poster_path: '/test.jpg',
  overview: 'A test movie',
  release_date: '2023-01-01',
  genre_ids: [28],
  requested_by: 'Alice',
  requested_at: '2023-06-01T00:00:00Z',
  status: 'pending' as RequestStatus,
  media_type: 'movie',
};

jest.mock('@/app/actions/request-actions', () => ({
  fulfillRequest: jest.fn(),
  downloadRequest: jest.fn(),
  cancelRequest: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RequestDetail', () => {
  it('renders request card', () => {
    render(<RequestDetail request={mockRequest} jellyfinAvailable={false} />);
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('calls fulfillRequest and refreshes on mark fulfilled', async () => {
    (fulfillRequest as jest.Mock).mockResolvedValueOnce({});
    render(<RequestDetail request={mockRequest} jellyfinAvailable={false} />);
    fireEvent.click(screen.getByText('Mark Fulfilled'));
    await waitFor(() => {
      expect(fulfillRequest).toHaveBeenCalledWith(mockRequest.id);
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('calls downloadRequest and refreshes on download', async () => {
    (downloadRequest as jest.Mock).mockResolvedValueOnce({});
    render(<RequestDetail request={mockRequest} jellyfinAvailable={false} />);
    fireEvent.click(screen.getByText('Start Download'));
    await waitFor(() => {
      expect(downloadRequest).toHaveBeenCalledWith(mockRequest.id);
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('redirects to list on cancel', async () => {
    (cancelRequest as jest.Mock).mockResolvedValueOnce({});
    render(<RequestDetail request={mockRequest} jellyfinAvailable={false} />);
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(cancelRequest).toHaveBeenCalledWith(mockRequest.id);
      expect(mockPush).toHaveBeenCalledWith('/requests');
    });
  });

  it('does not redirect on cancel error', async () => {
    (cancelRequest as jest.Mock).mockRejectedValueOnce(new Error('cancel failed'));
    render(<RequestDetail request={mockRequest} jellyfinAvailable={false} />);
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(cancelRequest).toHaveBeenCalledWith(mockRequest.id);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
