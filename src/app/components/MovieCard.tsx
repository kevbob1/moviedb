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
    
  const year = movie.release_date ? movie.release_date.toString() : undefined;

  return (
    <Link href={`/movies/${movie.id}`} className="block group w-full">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm bg-muted mb-2">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={movie.title ?? 'Movie poster'}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
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
