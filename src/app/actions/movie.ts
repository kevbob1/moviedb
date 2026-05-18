import { Prisma } from '@/generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { publishAudit } from '../../lib/kafka';
import { z } from 'zod';

const movieSchema = z.object({
  tmdb_id: z.number().positive('TMDB ID must be a positive number'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  release_date: z.number().optional(),
  poster_path: z.string().optional(),
  vote_average: z.number().min(0).max(10).optional(),
  genres: z.string().optional(),
});

export async function createMovie(data: Prisma.MovieCreateInput) {
  const validatedData = movieSchema.parse(data);

  const existingMovie = await prisma.movie.findUnique({
    where: { tmdb_id: validatedData.tmdb_id },
  });

  if (existingMovie) {
    throw new Error(`Movie with TMDB ID ${validatedData.tmdb_id} already exists`);
  }

  let movie;
  try {
    movie = await prisma.movie.create({ data: validatedData });
  } catch (error) {
    throw new Error(`Failed to create movie: ${(error as Error).message}`);
  }

  await publishAudit('created', movie.id, null, { ...movie } as Record<string, unknown>);
  return movie;
}