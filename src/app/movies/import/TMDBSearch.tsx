'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { TMDBMovie } from "@/lib/tmdb";
import { searchTMDBMovie, importTMDBMovie } from './actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
});

type SearchFormData = z.infer<typeof searchSchema>;

export function TMDBSearch() {
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TMDBMovie[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
  });

  const onSearch = async (data: SearchFormData) => {
    setIsSearching(true);
    setError(null);
    try {
      const results = await searchTMDBMovie(data.query);
      setSearchResults(results);
    } catch (err) {
      setError(`Failed to search movies: ${(err as Error).message}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const onImport = async (tmdbMovie: TMDBMovie) => {
    try {
      const movie = await importTMDBMovie(tmdbMovie);
      toast.success('Movie imported successfully!');
      router.push(`/movies/${movie.id}`);
    } catch (err) {
      toast.error(`Failed to import movie: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSearch)} className="space-y-4">
        <div>
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search TMDB *
          </label>
          <div className="flex gap-2">
            <input
              id="query"
              {...register('query')}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="Search for a movie..."
            />
            <button
              type="submit"
              disabled={isSearching}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {errors.query && <p className="mt-1 text-sm text-red-600">{errors.query.message}</p>}
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Search Results</h2>
          <div className="space-y-4">
            {searchResults.map((movie) => (
              <div 
                key={movie.id} 
                className="border border-gray-200 dark:border-gray-700 rounded-sm p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex gap-4">
                  {movie.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                      alt={movie.title}
                      width={64}
                      height={96}
                      className="object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                      <span className="text-gray-500 text-xs">No Image</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{movie.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown'} • {movie.genre_ids?.join(', ') || 'Unknown'}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      ★ {movie.vote_average?.toFixed(1) || 'N/A'}/10 (TMDb)
                    </p>
                    {movie.overview && (
                      <p className="text-gray-700 dark:text-gray-300 text-sm mt-2 line-clamp-2">
                        {movie.overview}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onImport(movie)}
                    className="self-center bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Import
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {searchResults.length === 0 && !isSearching && !error && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            Search for movies to import from TMDB
          </p>
        </div>
      )}
    </div>
  );
}