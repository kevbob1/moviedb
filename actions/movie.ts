import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publishAudit } from '../lib/kafka';

export async function createMovie(data: Prisma.MovieCreateInput) {
  let movie;
  try {
    movie = await prisma.movie.create({ data });
  } catch (error) {
    throw new Error(`Failed to create movie: ${(error as Error).message}`);
  }

  await publishAudit('created', movie.id, null, { ...movie } as Record<string, unknown>);
  return movie;
}
