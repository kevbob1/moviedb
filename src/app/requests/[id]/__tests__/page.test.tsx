import { render, screen } from '@testing-library/react';
import RequestPage from '../page';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    request: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/jellyfin', () => ({
  areMoviesOnJellyfin: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

import { prisma } from '@/lib/prisma';
import { areMoviesOnJellyfin } from '@/lib/jellyfin';
import { notFound } from 'next/navigation';

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
  requested_at: new Date('2023-06-01T00:00:00Z'),
  status: 'pending',
  season_number: null,
  media_type: 'movie',
};

describe('RequestPage', () => {
  it('renders request detail for valid id', async () => {
    (prisma.request.findUnique as jest.Mock).mockResolvedValueOnce(mockRequest);
    (areMoviesOnJellyfin as jest.Mock).mockResolvedValueOnce(new Map([[123, true]]));

    const Component = await RequestPage({ params: Promise.resolve({ id: '1' }) });
    render(Component);

    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('calls notFound for missing request', async () => {
    (prisma.request.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      RequestPage({ params: Promise.resolve({ id: '999' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
  });

  it('calls notFound for invalid id', async () => {
    await expect(
      RequestPage({ params: Promise.resolve({ id: 'not-a-number' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
    expect(prisma.request.findUnique).not.toHaveBeenCalled();
  });

  it('does not call areMoviesOnJellyfin when tmdbId is null', async () => {
    const requestWithoutTmdb = { ...mockRequest, tmdb_id: null };
    (prisma.request.findUnique as jest.Mock).mockResolvedValueOnce(requestWithoutTmdb);

    const Component = await RequestPage({ params: Promise.resolve({ id: '1' }) });
    render(Component);

    expect(areMoviesOnJellyfin).not.toHaveBeenCalled();
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
  });
});
