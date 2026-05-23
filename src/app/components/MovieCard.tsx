import Link from 'next/link';
import Image from 'next/image';
import { Movie } from '@/generated/prisma/client';

interface MovieCardProps {
  movie: Movie;
  tmdbId?: number;
}

export function MovieCard({ movie, tmdbId }: MovieCardProps) {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : null;
    
  const year = movie.release_date ? movie.release_date.toString() : undefined;

  const href = tmdbId 
    ? `https://www.themoviedb.org/movie/${tmdbId}` 
    : `/movies/${movie.id}`;

  return (
    <Link href={href} className="block group w-full" target="_blank" rel="noopener noreferrer">
      <div className="relative aspect-[2/3] w-32 overflow-hidden rounded-sm bg-muted mb-2">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={movie.title ?? 'Movie poster'}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="128px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm p-4 text-center">
            No Image
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <h3 className="font-semibold text-sm leading-tight line-clamp-1">{movie.title}</h3>
        {year && <span className="text-xs text-muted-foreground mt-0.5">{year}</span>}
      </div>
    </Link>
  );
}
