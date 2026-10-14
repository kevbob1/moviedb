'use client';

import Image from 'next/image';
import { useState } from 'react';

import { requestImport } from '@/app/actions/request-actions';
import { RequestForm } from '@/components/RequestForm';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Surface } from '@/components/ui/Surface';
import { Spinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import type { ImportResult } from '@/lib/import-flow';

type SearchType = 'movie' | 'tv';

/** Route failures answer with one field; anything else is a fallback message. */
function errorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }
  return fallback;
}

export default function ImportPage() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('movie');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setAvailabilityError(null);
    setResults([]);
    try {
      const response = await fetch(`/api/import/search?q=${encodeURIComponent(trimmed)}&type=${searchType}`);
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(data, 'Search failed'));
      const searchResult = data as { items: ImportResult[]; availability: { configured: boolean; error: string | null } };
      setResults(searchResult.items);
      if (!searchResult.availability.configured || searchResult.availability.error) {
        setAvailabilityError(searchResult.availability.error ?? 'Jellyfin is not configured.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const submitRequest = async (result: ImportResult, seasonNumber: number | 'all', requestedBy: string) => {
    const refreshed = await requestImport(result, seasonNumber, requestedBy);
    setResults((current) => current.map((item) => item.id === refreshed.id ? refreshed : item));
    setRequesting(null);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Surface elevation="raised" className="p-4 sm:p-6">
        <div className="mb-4 flex gap-2">
          <Button type="button" variant={searchType === 'movie' ? 'primary' : 'secondary'} onClick={() => setSearchType('movie')}>Movies</Button>
          <Button type="button" variant={searchType === 'tv' ? 'primary' : 'secondary'} onClick={() => setSearchType('tv')}>TV</Button>
        </div>
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
          <Input variant="search" label={`Search ${searchType === 'movie' ? 'movies' : 'TV shows'}`} value={query} onChange={(event) => setQuery(event.target.value)} className="flex-1" />
          <Button type="submit" size="lg" loading={loading}>{loading ? 'Searching' : 'Search'}{loading && <Spinner size="sm" />}</Button>
        </form>
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        {availabilityError && <div role="alert" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"><strong>Jellyfin:</strong> {availabilityError}</div>}
        <div className="mt-6 space-y-3">
          {results.map((result) => result.mediaType === 'movie' ? (
            <MovieResultCard key={result.id} result={result} requesting={requesting === `movie-${result.id}`} onRequest={() => setRequesting(`movie-${result.id}`)} onCancel={() => setRequesting(null)} onSubmit={(name) => submitRequest(result, 'all', name)} />
          ) : (
            <TvResultCard key={result.id} result={result} requesting={requesting} onRequest={(season) => setRequesting(`${result.id}-${season}`)} onCancel={() => setRequesting(null)} onSubmit={(season, name) => submitRequest(result, season, name)} />
          ))}
        </div>
      </Surface>
    </main>
  );
}

function MovieResultCard({ result, requesting, onRequest, onCancel, onSubmit }: { result: ImportResult; requesting: boolean; onRequest: () => void; onCancel: () => void; onSubmit: (name: string) => Promise<void> }) {
  return <Surface elevation="raised" className="flex gap-3 p-3">
    {result.poster_path ? <div className="w-20 max-w-[35vw] flex-shrink-0"><Image src={`https://image.tmdb.org/t/p/w185${result.poster_path}`} alt={result.title ?? ''} width={80} height={120} sizes="80px" className="h-auto w-full rounded-lg" /></div> : <div className="aspect-[2/3] w-20 max-w-[35vw] flex-shrink-0 rounded-lg bg-surface" />}
    <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><h2 className="font-semibold">{result.title}</h2>{result.onJellyfin && <Pill variant="available" label="On Jellyfin" />}</div><p className="text-sm text-muted-foreground">{result.overview}</p><div className="mt-2">{!result.onJellyfin && !requesting && <Button size="sm" onClick={onRequest}>Request</Button>}{requesting && <RequestForm isVisible onSubmit={onSubmit} onCancel={onCancel} />}</div></div>
  </Surface>;
}

/**
 * Renders the projected season rows the module already answered. Nothing here
 * decides which seasons are regular or missing — that is module work.
 */
function TvResultCard({ result, requesting, onRequest, onCancel, onSubmit }: { result: ImportResult; requesting: string | null; onRequest: (season: number | 'all') => void; onCancel: () => void; onSubmit: (season: number | 'all', name: string) => Promise<void> }) {
  const rows = result.seasonRows ?? [];
  const requestable = rows.filter((row) => !row.available);
  return <Surface elevation="raised" className="flex gap-3 p-3">
    {result.poster_path ? <div className="w-20 max-w-[35vw] flex-shrink-0"><Image src={`https://image.tmdb.org/t/p/w185${result.poster_path}`} alt={result.name ?? ''} width={80} height={120} sizes="80px" className="h-auto w-full rounded-lg" /></div> : <div className="aspect-[2/3] w-20 max-w-[35vw] flex-shrink-0 rounded-lg bg-surface" />}
    <div className="min-w-0 flex-1">
      <div className="flex justify-between gap-2"><h2 className="font-semibold">{result.name}</h2>{result.onJellyfin && <Pill variant="available" label="On Jellyfin" />}</div>
      <p className="text-sm text-muted-foreground">{result.overview}</p>
      {result.seasonError && <p role="status" className="mt-2 text-xs text-amber-200">Seasons unavailable: {result.seasonError}</p>}
      <div className="mt-3 space-y-2">
        {rows.map((row) => <div key={row.season.season_number} className="flex items-center justify-between"><span>Season {row.season.season_number}</span>{!row.available && requesting !== `${result.id}-${row.season.season_number}` && <Button size="sm" onClick={() => onRequest(row.season.season_number)}>Request</Button>}{requesting === `${result.id}-${row.season.season_number}` && <RequestForm isVisible onSubmit={(name) => onSubmit(row.season.season_number, name)} onCancel={onCancel} />}</div>)}
        {requestable.length > 0 && requesting !== `${result.id}-all` && <Button size="sm" onClick={() => onRequest('all')}>Request all seasons</Button>}
        {requesting === `${result.id}-all` && <RequestForm isVisible onSubmit={(name) => onSubmit('all', name)} onCancel={onCancel} />}
      </div>
    </div>
  </Surface>;
}
