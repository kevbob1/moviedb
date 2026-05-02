import { createMovie } from '../../actions/movie';
import { prisma } from '../../lib/prisma';
import * as kafka from '../../lib/kafka';

jest.mock('../../lib/kafka', () => ({
  publishAudit: jest.fn()
}));

describe('Movie Actions', () => {
  it('creates a movie and publishes audit event', async () => {
    const publishSpy = jest.spyOn(kafka, 'publishAudit');

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
    expect(publishSpy).toHaveBeenCalledWith('created', result.id, null, expect.objectContaining({ title: 'Fight Club' }));
  });
});
