import { createMovie } from './movie';
import { prisma } from '../../lib/prisma';
import * as kafka from '../../lib/kafka';

jest.mock('../../lib/kafka', () => ({
  publishAudit: jest.fn()
}));

describe('Movie Actions', () => {
  beforeEach(async () => {
    await prisma.movie.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a movie and publishes audit event', async () => {
    const result = await createMovie({ tmdb_id: 550, title: 'Fight Club', release_date: 1999 });

    expect(result.tmdb_id).toBe(550);
    expect(result.title).toBe('Fight Club');

    const persisted = await prisma.movie.findUnique({ where: { tmdb_id: 550 } });
    expect(persisted).not.toBeNull();
    expect(persisted!.title).toBe('Fight Club');

    expect(kafka.publishAudit as jest.Mock).toHaveBeenCalledWith(
      'created',
      result.id,
      null,
      expect.objectContaining({ title: 'Fight Club' })
    );
  });

  it('rejects duplicate tmdb_id and does NOT publish audit event', async () => {
    await prisma.movie.create({ data: { tmdb_id: 999, title: 'Original Movie' } });

    await expect(
      createMovie({ tmdb_id: 999, title: 'Duplicate Movie' })
    ).rejects.toThrow('Movie with TMDB ID 999 already exists');

    expect(kafka.publishAudit as jest.Mock).not.toHaveBeenCalled();
  });
});
