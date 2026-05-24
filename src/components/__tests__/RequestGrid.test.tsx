import { render, screen } from '@testing-library/react';
import { RequestGrid } from '../RequestGrid';

describe('RequestGrid', () => {
  const mockRequests = [
    { id: 1, title: 'Movie 1', tmdb_id: 123, poster_path: '/1.jpg', requested_at: new Date(), requested_by: 'Alice', status: 'pending' as const, media_type: 'movie' as const },
    { id: 2, title: 'Movie 2', tmdb_id: 456, poster_path: '/2.jpg', requested_at: new Date(), requested_by: 'Bob', status: 'downloading' as const, media_type: 'movie' as const }
  ];

  it('renders all requests', () => {
    render(
      <RequestGrid
        requests={mockRequests}
        onJellyfin={() => false}
      />
    );
    expect(screen.getByText('Movie 1')).toBeInTheDocument();
    expect(screen.getByText('Movie 2')).toBeInTheDocument();
  });

  it('renders empty state when no requests', () => {
    render(
      <RequestGrid
        requests={[]}
        onJellyfin={() => false}
      />
    );
    expect(screen.getByText(/no requests/i)).toBeInTheDocument();
  });
});
