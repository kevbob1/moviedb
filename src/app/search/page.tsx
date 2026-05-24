'use client';

import { useState } from 'react';
import Image from 'next/image';
import { TMDBMovie } from '@/lib/tmdb';
import { isMovieOnJellyfin } from '@/lib/jellyfin';
import { createRequest } from '@/app/actions/request-actions';
import { RequestForm } from '@/components/RequestForm';
import { JellyfinBadge } from '@/components/JellyfinBadge';

export default function ImportPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jellyfinStatus, setJellyfinStatus] = useState<Map<number, boolean>>(new Map());
  const [requesting, setRequesting] = useState<number | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || 'Search failed');
      }
      const data = await res.json();
      setResults(data.results);

      const jellyfinChecks = await Promise.all(
        data.results.map(async (movie: TMDBMovie) => ({
          id: movie.id,
          available: await isMovieOnJellyfin(movie.id)
        }))
      );

      setJellyfinStatus(new Map(jellyfinChecks.map(c => [c.id, c.available])));
    } catch (err) {
      console.error('Search failed:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (movie: TMDBMovie, requestedBy: string) => {
    try {
      await createRequest(movie.id, movie.title, movie.poster_path || null, requestedBy);
      setRequesting(null);

      if (movie.id) {
        const available = await isMovieOnJellyfin(movie.id);
        setJellyfinStatus(prev => new Map(prev).set(movie.id, available));
      }
    } catch (err) {
      console.error('Failed to create request:', err);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Request a Movie
      </h1>

      <form onSubmit={handleSearch} className="mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a movie..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {results.map((movie) => {
          const onJellyfin = jellyfinStatus.get(movie.id) || false;
          const isRequesting = requesting === movie.id;

          return (
            <div
              key={movie.id}
              className="bg-white dark:bg-gray-800 rounded-sm shadow-sm p-4"
            >
              {movie.poster_path && (
                <div className="w-full h-[300px] mb-3">
                  <Image
                    src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                    alt={movie.title}
                    width={0}
                    height={0}
                    sizes="100vw"
                    className="w-full h-full object-cover rounded-sm"
                  />
                </div>
              )}

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {movie.title}
              </h3>

              {onJellyfin && <JellyfinBadge available={true} />}

              {!onJellyfin && !isRequesting && (
                <button
                  onClick={() => setRequesting(movie.id)}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 w-full"
                >
                  Request
                </button>
              )}

              {isRequesting && (
                <RequestForm
                  isVisible={true}
                  onSubmit={(requestedBy) => handleRequest(movie, requestedBy)}
                  onCancel={() => setRequesting(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}