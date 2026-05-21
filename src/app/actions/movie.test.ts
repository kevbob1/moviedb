import { createMovie } from './movie';
import { prisma } from '../../lib/prisma';

const mockCreate = prisma.movie.create as jest.Mock;
const mockFindUnique = prisma.movie.findUnique as jest.Mock;

describe('Movie Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a movie', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({ tmdb_id: 550, title: 'Fight Club', release_date: 1999 });
    mockFindUnique.mockResolvedValueOnce({ tmdb_id: 550, title: 'Fight Club', release_date: 1999 });

    const result = await createMovie({ tmdb_id: 550, title: 'Fight Club', release_date: 1999 });

    expect(result.tmdb_id).toBe(550);
    expect(result.title).toBe('Fight Club');

    const persisted = await prisma.movie.findUnique({ where: { tmdb_id: 550 } });
    expect(persisted).not.toBeNull();
    expect(persisted!.title).toBe('Fight Club');
  });

  it('rejects duplicate tmdb_id', async () => {
    mockFindUnique.mockResolvedValueOnce({ tmdb_id: 999, title: 'Original Movie' });

    await expect(
      createMovie({ tmdb_id: 999, title: 'Duplicate Movie' })
    ).rejects.toThrow('Movie with TMDB ID 999 already exists');
  });
});