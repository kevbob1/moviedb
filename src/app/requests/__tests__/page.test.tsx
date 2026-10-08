import { render, screen } from '@testing-library/react';
import RequestsPage, { dynamic } from '../page';

jest.mock('@/lib/request-lifecycle', () => ({
  requestService: {
    listRequests: jest.fn(),
  },
}));

jest.mock('@/lib/jellyfin', () => ({
  availabilityFor: jest.fn(),
}));

import { requestService } from '@/lib/request-lifecycle';
import { availabilityFor } from '@/lib/jellyfin';

beforeEach(() => {
  jest.clearAllMocks();
});

const mockRequest = {
  id: 1,
  title: 'Test Movie',
  tmdb_id: 123,
  poster_path: '/test.jpg',
  overview: 'A test movie',
  release_date: '2023-01-01',
  genre_ids: [28],
  requested_by: 'Alice',
  requested_at: '2023-06-01T00:00:00.000Z',
  status: 'pending',
  season_number: undefined,
  media_type: 'movie',
};

describe('RequestsPage', () => {
  it('renders dynamically because it reads from the database', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('reads the active page and renders the requests', async () => {
    (requestService.listRequests as jest.Mock).mockResolvedValueOnce({
      rows: [mockRequest],
      total: 1,
      totalPages: 1,
    });
    (availabilityFor as jest.Mock).mockResolvedValueOnce({
      [123]: { available: true, configured: true },
    });

    const Component = await RequestsPage({ searchParams: Promise.resolve({}) });
    render(Component);

    expect(requestService.listRequests).toHaveBeenCalledWith({
      page: 1,
      includeResolved: false,
    });
    expect(availabilityFor).toHaveBeenCalledWith([123]);
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('passes showFulfilled through as includeResolved', async () => {
    (requestService.listRequests as jest.Mock).mockResolvedValueOnce({
      rows: [],
      total: 0,
      totalPages: 0,
    });
    (availabilityFor as jest.Mock).mockResolvedValueOnce({});

    await RequestsPage({ searchParams: Promise.resolve({ showFulfilled: 'true' }) });

    expect(requestService.listRequests).toHaveBeenCalledWith({
      page: 1,
      includeResolved: true,
    });
  });

  it('passes the requested page and renders pagination', async () => {
    (requestService.listRequests as jest.Mock).mockResolvedValueOnce({
      rows: [mockRequest, mockRequest],
      total: 13,
      totalPages: 2,
    });
    (availabilityFor as jest.Mock).mockResolvedValueOnce({});

    const Component = await RequestsPage({
      searchParams: Promise.resolve({ page: '2' }),
    });
    render(Component);

    expect(requestService.listRequests).toHaveBeenCalledWith({
      page: 2,
      includeResolved: false,
    });
    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
  });
});