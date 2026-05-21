import Link from 'next/link';
import Image from 'next/image';
import { Movie } from '@/generated/prisma/client';

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : null;

  return (
    <Link
      href={`/movies/${movie.id}`}
      className="block bg-white dark:bg-gray-800 rounded-sm shadow-sm hover:shadow transition-shadow overflow-hidden"
    >
      <div className="aspect-[2/3] relative bg-gray-200 dark:bg-gray-700">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={movie.title ?? 'Movie poster'}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Poster
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
          {movie.title}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
          {movie.release_date && <span>{movie.release_date}</span>}
          {movie.vote_average && movie.vote_average > 0 && (
            <span className="inline-flex items-center">
              ★ {movie.vote_average.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}