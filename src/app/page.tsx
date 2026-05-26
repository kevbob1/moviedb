'use client';

import { useState } from 'react';
import Image from 'next/image';
import { TMDBMovie } from '@/lib/tmdb';
import { createRequest } from '@/app/actions/request-actions';
import { RequestForm } from '@/components/RequestForm';
import { JellyfinBadge } from '@/components/JellyfinBadge';
import { GENRE_MAP } from '@/lib/genres';

function getGenreNamesDisplay(ids: number[] | undefined): string {
  if (!ids?.length) return '';
  return ids.map(id => GENRE_MAP[id]).filter(Boolean).join(', ');
}

function getYear(date: string | undefined): string {
  return date?.split('-')[0] || '';
}

interface JellyfinStatus {
  results: Record<number, boolean>;
  error?: string;
  configured: boolean;
}

export default function ImportPage() {
const [query, setQuery] = useState('');
const [results, setResults] = useState<TMDBMovie[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [jellyfinStatus, setJellyfinStatus] = useState<Map<number, boolean>>(new Map());
const [requesting, setRequesting] = useState<number | null>(null);
const [jellyfinError, setJellyfinError] = useState<string | null>(null);

const handleSearch = async (e: React.FormEvent) => {
e.preventDefault();
if (!query.trim()) return;

setLoading(true);
setError(null);
setJellyfinError(null);
try {
  const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.details || 'Search failed');
  }
  const data = await res.json();
  setResults(data.results);

const ids = data.results.map((movie: TMDBMovie) => movie.id);
if (ids.length > 0) {
const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${ids.join(',')}`);
const jellyfinData: JellyfinStatus = await jellyfinRes.json();

if (jellyfinData.error) {
  setJellyfinError(jellyfinData.error);
}

setJellyfinStatus(new Map(Object.entries(jellyfinData.results).map(([k, v]) => [parseInt(k, 10), v])));
}
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
    await createRequest(
      movie.id,
      movie.title,
      movie.poster_path || null,
      requestedBy,
      movie.release_date,
      movie.overview,
      movie.genre_ids
    );
  setRequesting(null);

  if (movie.id) {
    const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${movie.id}`);
    const jellyfinData: JellyfinStatus = await jellyfinRes.json();
    const available = jellyfinData.results[movie.id] || false;
    setJellyfinStatus(prev => new Map(prev).set(movie.id, available));
    
    if (jellyfinData.error) {
      setJellyfinError(jellyfinData.error);
    }
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

<form onSubmit={handleSearch} className="mb-8 flex flex-col md:flex-row gap-2">
<input
  type="text"
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  placeholder="Search for a movie..."
  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>
<button
  type="submit"
  disabled={loading}
  className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50 w-full md:w-auto"
>
  {loading ? 'Searching...' : 'Search'}
</button>
</form>

{error && (
<div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-sm">
  {error}
</div>
)}

{jellyfinError && (
<div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-sm">
  <strong>Jellyfin Status:</strong> {jellyfinError}
</div>
)}

<div className="space-y-3">
{results.map((movie) => {
const onJellyfin = jellyfinStatus.get(movie.id) || false;
const isRequesting = requesting === movie.id;

return (
<div
  key={movie.id}
  className="bg-white dark:bg-gray-800 rounded-sm shadow-sm p-3 flex flex-col md:flex-row gap-4"
>
{movie.poster_path ? (
  <div className="w-16 h-24 flex-shrink-0">
  <Image
    src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`}
    alt={movie.title}
    width={64}
    height={96}
    className="w-full h-full object-cover rounded-sm"
  />
  </div>
) : (
  <div className="w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded-sm flex-shrink-0" />
)}

<div className="flex-1 min-w-0">
  <div className="flex items-start justify-between gap-2">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {movie.title}
        <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
          {getYear(movie.release_date)}
        </span>
      </h3>
      {movie.genre_ids && movie.genre_ids.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {getGenreNamesDisplay(movie.genre_ids)}
        </p>
      )}
    </div>
    <JellyfinBadge available={onJellyfin} />
  </div>

  {movie.overview && (
    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
      {movie.overview}
    </p>
  )}

  {!onJellyfin && !isRequesting && (
    <button
      onClick={() => setRequesting(movie.id)}
      className="px-3 py-2 bg-blue-600 text-white text-sm rounded-sm hover:bg-blue-700 w-full md:w-auto"
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
</div>
);
})}
</div>
</main>
);
}
