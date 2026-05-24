import { render, screen } from '@testing-library/react';
import { RequestCard } from '../RequestCard';

describe('RequestCard', () => {
  const mockRequest = {
    id: 1,
    title: 'Test Movie',
    tmdb_id: 123,
    poster_path: '/test.jpg',
    requested_at: new Date('2026-05-23'),
    requested_by: 'Alice',
    status: 'pending' as const,
    media_type: 'movie' as const
  };

  it('renders request title', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => false} />);
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
  });

  it('shows requester and date', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => false} />);
    expect(screen.getByText(/requested by:/i)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows status badge', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => false} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows Jellyfin badge when available', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => true} />);
    expect(screen.getByText('On Jellyfin')).toBeInTheDocument();
  });

  it('does not show Jellyfin badge when not available', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => false} />);
    expect(screen.queryByText('On Jellyfin')).not.toBeInTheDocument();
  });

  it('shows mark fulfilled button', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => false} />);
    expect(screen.getByRole('button', { name: /mark fulfilled/i })).toBeInTheDocument();
  });
});
