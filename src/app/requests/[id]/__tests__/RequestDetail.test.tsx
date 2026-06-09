import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RequestDetail from '../RequestDetail';
import { RequestStatus } from '@/lib/request-fsm';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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

import { cancelRequest } from '@/app/actions/request-actions';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RequestDetail', () => {
  it('renders request card', () => {
    render(<RequestDetail request={mockRequest} jellyfinAvailable={false} />);
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
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
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
