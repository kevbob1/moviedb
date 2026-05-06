import { createMovie } from './movie';
import { prisma } from '../../lib/prisma';
import * as kafka from '../../lib/kafka';

jest.mock('../../lib/kafka', () => ({
  publishAudit: jest.fn()
}));

describe('Movie Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a movie and publishes audit event', async () => {
    const result = await createMovie({
      tmdb_id: 550,
      title: 'Fight Club',
      release_date: 1999
    });

    // DB Verification
    const inDb = await prisma.movie.findUnique({ where: { id: result.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.title).toBe('Fight Club');

    // Audit Verification
    expect(kafka.publishAudit as jest.Mock).toHaveBeenCalledWith(
      'created',
      result.id,
      null,
      expect.objectContaining({ title: 'Fight Club' })
    );
  });

  it('does NOT publish audit event when DB create fails', async () => {
    // Insert first to force a unique constraint violation on tmdb_id
    await prisma.movie.create({ data: { tmdb_id: 999, title: 'Existing Movie' } });

    await expect(
      createMovie({ tmdb_id: 999, title: 'Duplicate Movie' })
    ).rejects.toThrow('Failed to create movie');

    expect(kafka.publishAudit as jest.Mock).not.toHaveBeenCalled();
  });
});
