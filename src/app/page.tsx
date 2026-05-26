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
<main className="page-container">
<h1 className="page-title">
  Request a Movie
</h1>

<form onSubmit={handleSearch} className="form-row-lg">
<input
  type="text"
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  placeholder="Search for a movie..."
  className="input flex-1"
/>
<button
  type="submit"
  disabled={loading}
  className="btn-primary btn-md btn-responsive"
>
  {loading ? 'Searching...' : 'Search'}
</button>
</form>

{error && (
<div className="alert-error">
  {error}
</div>
)}

{jellyfinError && (
<div className="alert-warning">
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
  className="card-row"
>
{movie.poster_path ? (
  <div className="poster-sm">
  <Image
    src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`}
    alt={movie.title}
    width={64}
    height={96}
    className="poster-img"
  />
  </div>
) : (
  <div className="poster-sm bg-gray-200 dark:bg-gray-700 rounded-sm" />
)}

<div className="flex-1 min-w-0">
  <div className="flex items-start justify-between gap-2">
    <div>
      <h3 className="card-title">
        {movie.title}
        <span className="ml-2 text-sm font-normal text-muted">
          {getYear(movie.release_date)}
        </span>
      </h3>
      {movie.genre_ids && movie.genre_ids.length > 0 && (
        <p className="text-xs text-muted mb-1">
          {getGenreNamesDisplay(movie.genre_ids)}
        </p>
      )}
    </div>
    <JellyfinBadge available={onJellyfin} />
  </div>

  {movie.overview && (
    <p className="text-body line-clamp-2 mb-2">
      {movie.overview}
    </p>
  )}

  {!onJellyfin && !isRequesting && (
    <button
      onClick={() => setRequesting(movie.id)}
      className="btn-primary btn-sm btn-responsive"
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
