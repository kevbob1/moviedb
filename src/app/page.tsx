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
import type { ImportResult, Season } from '@/lib/import-flow';

type SearchType = 'movie' | 'tv';

function errorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null && 'details' in data && typeof data.details === 'string') return data.details;
  if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') return data.error;
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
      if (searchType === 'tv') {
        const hydrated = await Promise.all(searchResult.items.map(async (item) => {
          const seasonsResponse = await fetch(`/api/import/seasons?id=${item.id}`);
          if (!seasonsResponse.ok) return item;
          const seasonsData = await seasonsResponse.json() as { seasons: Season[] | null };
          const allSeasons = seasonsData.seasons ?? [];
          const regular = allSeasons.filter((season) => season.season_number > 0).map((season) => season.season_number);
          return { ...item, allSeasons, missingSeasons: regular.filter((number) => !item.availableSeasons.includes(number)) };
        }));
        setResults(hydrated);
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
    {result.poster_path ? <Image src={`https://image.tmdb.org/t/p/w185${result.poster_path}`} alt={result.title ?? ''} width={80} height={120} className="h-auto w-20 rounded-lg object-cover" /> : <div className="h-[120px] w-20 rounded-lg bg-surface" />}
    <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><h2 className="font-semibold">{result.title}</h2>{result.onJellyfin && <Pill variant="available" label="On Jellyfin" />}</div><p className="text-sm text-muted-foreground">{result.overview}</p><div className="mt-2">{!result.onJellyfin && !requesting && <Button size="sm" onClick={onRequest}>Request</Button>}{requesting && <RequestForm isVisible onSubmit={onSubmit} onCancel={onCancel} />}</div></div>
  </Surface>;
}

function TvResultCard({ result, requesting, onRequest, onCancel, onSubmit }: { result: ImportResult; requesting: string | null; onRequest: (season: number | 'all') => void; onCancel: () => void; onSubmit: (season: number | 'all', name: string) => Promise<void> }) {
  const seasons = (result.allSeasons ?? []).filter((season) => season.season_number > 0);
  return <Surface elevation="raised" className="p-3"><div className="flex justify-between gap-2"><h2 className="font-semibold">{result.name}</h2>{result.onJellyfin && <Pill variant="available" label="On Jellyfin" />}</div><p className="text-sm text-muted-foreground">{result.overview}</p><div className="mt-3 space-y-2">{seasons.map((season) => <div key={season.season_number} className="flex items-center justify-between"><span>Season {season.season_number}</span>{result.missingSeasons.includes(season.season_number) && requesting !== `${result.id}-${season.season_number}` && <Button size="sm" onClick={() => onRequest(season.season_number)}>Request</Button>}{requesting === `${result.id}-${season.season_number}` && <RequestForm isVisible onSubmit={(name) => onSubmit(season.season_number, name)} onCancel={onCancel} />}</div>)}{result.missingSeasons.length > 0 && requesting !== `${result.id}-all` && <Button size="sm" onClick={() => onRequest('all')}>Request all seasons</Button>}{requesting === `${result.id}-all` && <RequestForm isVisible onSubmit={(name) => onSubmit('all', name)} onCancel={onCancel} />}</div></Surface>;
}
