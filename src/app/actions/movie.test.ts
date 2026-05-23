import { createMovie, deleteMovie } from './movie';
import { prisma } from '../../lib/prisma';

const mockCreate = prisma.movie.create as jest.Mock;
const mockFindUnique = prisma.movie.findUnique as jest.Mock;
const mockDelete = prisma.movie.delete as jest.Mock;

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

describe('deleteMovie', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes an existing movie', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 1, title: 'Test Movie' });
    mockDelete.mockResolvedValueOnce({ id: 1, title: 'Test Movie' });

    await deleteMovie(1);

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('throws if movie does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(deleteMovie(999)).rejects.toThrow('Movie with ID 999 not found');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('throws for invalid movieId', async () => {
    await expect(deleteMovie(-1)).rejects.toThrow('ID must be a positive number');
    await expect(deleteMovie(0)).rejects.toThrow('ID must be a positive number');
    expect(mockDelete).not.toHaveBeenCalled();
  });
});