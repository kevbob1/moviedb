'use server';

import { Prisma } from '@/generated/prisma/client';
import { createMovie } from '@/app/actions/movie';
import { getTMDBMovieDetails, TMDBMovie, searchTMDBMovies } from "@/lib/tmdb";

export async function searchTMDBMovie(query: string): Promise<TMDBMovie[]> {
  return searchTMDBMovies(query);
}

export async function importTMDBMovie(tmdbMovie: TMDBMovie) {
  try {
    const fullMovie = await getTMDBMovieDetails(tmdbMovie.id);
    
    const movieData: Prisma.MovieCreateInput = {
      tmdb_id: fullMovie.id,
      title: fullMovie.title,
      description: fullMovie.overview || undefined,
      release_date: fullMovie.release_date 
        ? parseInt(fullMovie.release_date.substring(0, 4))
        : undefined,
      poster_path: fullMovie.poster_path || undefined,
      vote_average: fullMovie.vote_average || undefined,
      genres: fullMovie.genres?.map(g => g.name).join(', ') || undefined,
    };

    const movie = await createMovie(movieData);
    return movie;
  } catch (error) {
    throw new Error(`Failed to import movie: ${(error as Error).message}`);
  }
}