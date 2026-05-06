import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MoviePage({ params }: Props) {
  const { id } = await params;
  const movie = await prisma.movie.findUnique({ where: { id } });

  if (!movie) {
    notFound();
  }

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : null;

  const genres : string[] = movie.genres
    ? movie.genres.split(',').map((g:string) => g.trim())
    : [];

  return (
    <main className="container mx-auto px-4 py-8">
      <Link
        href="/movies"
        className="inline-block mb-6 text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        ← Back to movies
      </Link>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-shrink-0">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={movie.title}
              className="rounded-lg shadow-lg w-full max-w-xs mx-auto md:mx-0"
            />
          ) : (
            <div className="w-full max-w-xs h-96 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400">
              No Poster
            </div>
          )}
        </div>

        <div className="flex-grow">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {movie.title}
          </h1>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {movie.vote_average && movie.vote_average > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                ★ {movie.vote_average.toFixed(1)}
              </span>
            )}

            {movie.release_date && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {movie.release_date}
              </span>
            )}
          </div>

          {genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {genres.map((genre : string) => (
                <span
                  key={genre}
                  className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {movie.description && (
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
              {movie.description}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}