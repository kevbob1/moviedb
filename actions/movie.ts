import { prisma } from '../lib/prisma';
import { publishAudit } from '../lib/kafka';

export async function createMovie(data: { tmdb_id: number; title: string; release_date?: number }) {
  const movie = await prisma.movie.create({ data });
  await publishAudit('created', movie.id, null, movie);
  return movie;
}
