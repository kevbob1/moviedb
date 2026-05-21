// src/components/SimilarMovies.tsx
import { getSimilarMovies } from "@/lib/tmdb";
import { MovieCard } from "./MovieCard";

interface SimilarMoviesProps {
  tmdbId: number | null;
}

export async function SimilarMovies({ tmdbId }: SimilarMoviesProps) {
  if (!tmdbId) return null;

  const movies = await getSimilarMovies(tmdbId);
  
  if (!movies || movies.length === 0) return null;

  const displayMovies = movies.slice(0, 6); // Show top 6

  return (
    <section className="mt-16 border-t pt-8">
      <h2 className="text-xl font-bold mb-6">Similar Movies</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {displayMovies.map((movie) => (
          <MovieCard
            key={movie.id}
            id={movie.id} // Note: This routes to TMDB ID. In a full implementation, we'd map to local ID if exists.
            title={movie.title}
            year={movie.release_date?.split('-')[0]}
            posterUrl={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null}
          />
        ))}
      </div>
    </section>
  );
}