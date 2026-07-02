'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { createRequest, createTvShowRequests } from '@/app/actions/request-actions';
import { RequestForm } from '@/components/RequestForm';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Surface } from '@/components/ui/Surface';
import { StaggerList } from '@/components/motion/StaggerList';
import { useReducedMotion } from '@/lib/motion';
import { fadeUp } from '@/components/motion/variants';
import { GENRE_MAP } from '@/lib/genres';
import { logger } from '@/lib/logger';

type SearchType = 'movie' | 'tv';

interface TMDBMovieResult {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  poster_path?: string;
  genre_ids?: number[];
}

interface TMDBSeriesResult {
  id: number;
  name: string;
  overview?: string;
  first_air_date?: string;
  poster_path?: string;
  genre_ids?: number[];
}

interface JellyfinCheckResponse {
  results: Record<number, boolean>;
  seasons: Record<number, number[]>;
  error?: string;
  configured: boolean;
}

interface TMDBSeason {
  season_number: number;
  name: string;
  episode_count: number;
}

function getGenreNamesDisplay(ids: number[] | undefined): string {
  if (!ids?.length) return '';
  return ids.map(id => GENRE_MAP[id]).filter(Boolean).join(', ');
}

function getYear(date: string | undefined): string {
  return date?.split('-')[0] || '';
}

export default function ImportPage() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('movie');
  const [movieResults, setMovieResults] = useState<TMDBMovieResult[]>([]);
  const [tvResults, setTvResults] = useState<TMDBSeriesResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jellyfinResults, setJellyfinResults] = useState<Record<number, boolean>>({});
  const [jellyfinSeasons, setJellyfinSeasons] = useState<Record<number, number[]>>({});
  const [tmdbSeasons, setTmdbSeasons] = useState<Record<number, TMDBSeason[]>>({});
  const [requesting, setRequesting] = useState<string | null>(null);
  const [jellyfinError, setJellyfinError] = useState<string | null>(null);

  const currentResults = searchType === 'movie' ? movieResults : tvResults;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setJellyfinError(null);
    setMovieResults([]);
    setTvResults([]);

    try {
      const res = await fetch(`/api/tmdb/search?type=${searchType}&q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || 'Search failed');
      }
      const data = await res.json();

      if (searchType === 'movie') {
        setMovieResults(data.results);
        const ids: number[] = data.results.map((m: TMDBMovieResult) => m.id);
        if (ids.length > 0) {
          const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${ids.join(',')}`);
          const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
          if (jellyfinData.error) setJellyfinError(jellyfinData.error);
          setJellyfinResults(jellyfinData.results || {});
        }
      } else {
        setTvResults(data.results);
        const ids: number[] = data.results.map((s: TMDBSeriesResult) => s.id);
        if (ids.length > 0) {
          const [jellyfinRes, seasonsRes] = await Promise.all([
            fetch(`/api/jellyfin/check?ids=${ids.join(',')}`),
            fetch(`/api/tmdb/tv/seasons?ids=${ids.join(',')}`),
          ]);
          const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
          const seasonsData = await seasonsRes.json();

          if (jellyfinData.error) setJellyfinError(jellyfinData.error);
          setJellyfinResults(jellyfinData.results || {});
          setJellyfinSeasons(jellyfinData.seasons || {});
          setTmdbSeasons(seasonsData.seasons || {});
        }
      }
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Search failed');
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMovieRequest = async (movie: TMDBMovieResult, requestedBy: string) => {
    try {
      await createRequest(movie.id, movie.title, movie.poster_path || null, requestedBy, movie.release_date, movie.overview, movie.genre_ids, 'movie');
      setRequesting(null);
      const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${movie.id}`);
      const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
      setJellyfinResults(prev => ({ ...prev, [movie.id]: jellyfinData.results[movie.id] || false }));
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to create request');
      throw err;
    }
  };

  const handleSeasonRequest = async (show: TMDBSeriesResult, seasonNumber: number, requestedBy: string) => {
    try {
      await createRequest(show.id, show.name, show.poster_path || null, requestedBy, show.first_air_date, show.overview, show.genre_ids, 'tv', seasonNumber);
      setRequesting(null);
      const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${show.id}`);
      const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
      setJellyfinSeasons(prev => ({ ...prev, [show.id]: jellyfinData.seasons[show.id] || [] }));
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to create request');
      throw err;
    }
  };

  const handleRequestAllSeasons = async (show: TMDBSeriesResult, requestedBy: string) => {
    try {
      await createTvShowRequests(show.id, requestedBy);
      setRequesting(null);
      const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${show.id}`);
      const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
      setJellyfinSeasons(prev => ({ ...prev, [show.id]: jellyfinData.seasons[show.id] || [] }));
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to create TV requests');
      throw err;
    }
  };

  const reduced = useReducedMotion();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <motion.section
        variants={reduced ? undefined : fadeUp}
        initial="hidden"
        animate="visible"
        className="mb-8 text-center sm:mb-12"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">● Live</p>
        <h1 className="font-display text-4xl italic leading-[1.05] text-foreground sm:text-5xl">
          What&rsquo;s on tonight?
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Search your library or request a new title
        </p>
      </motion.section>

      <Surface elevation="raised" className="p-4 sm:p-6">
        <SearchTypeToggle value={searchType} onChange={setSearchType} />

        <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            variant="search"
            label={`Search ${searchType === 'movie' ? 'movies' : 'TV shows'}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchType === 'movie' ? 'Try "Dune Part Two"' : 'Try "The Bear"'}
            className="flex-1"
          />
          <Button type="submit" size="lg" loading={loading} className="sm:w-auto">
            {loading ? 'Searching' : 'Search'}
            {loading && <Spinner size="sm" />}
          </Button>
        </form>

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {jellyfinError && (
          <div role="alert" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <strong>Jellyfin:</strong> {jellyfinError}
          </div>
        )}

        {currentResults.length > 0 && (
          <div className="mt-6 space-y-3">
            <StaggerList
              items={currentResults as (TMDBMovieResult | TMDBSeriesResult)[]}
              className="space-y-3"
              renderItem={(item) => (
                searchType === 'movie'
                  ? <MovieResultCard
                      key={(item as TMDBMovieResult).id}
                      movie={item as TMDBMovieResult}
                      onJellyfin={jellyfinResults[(item as TMDBMovieResult).id] || false}
                      isRequesting={requesting === String((item as TMDBMovieResult).id)}
                      onRequest={() => setRequesting(String((item as TMDBMovieResult).id))}
                      onSubmit={(name) => handleMovieRequest(item as TMDBMovieResult, name)}
                      onCancel={() => setRequesting(null)}
                    />
                  : <TvResultCard
                      key={(item as TMDBSeriesResult).id}
                      show={item as unknown as TMDBSeriesResult}
                      availableSeasons={jellyfinSeasons[(item as TMDBSeriesResult).id] || []}
                      allSeasons={tmdbSeasons[(item as TMDBSeriesResult).id] || []}
                      requesting={requesting}
                      onRequestSeason={(n) => setRequesting(`${(item as TMDBSeriesResult).id}-${n}`)}
                      onRequestAll={() => setRequesting(`${(item as TMDBSeriesResult).id}-all`)}
                      onSubmitSeason={(n, name) => handleSeasonRequest(item as unknown as TMDBSeriesResult, n, name)}
                      onSubmitAll={(name) => handleRequestAllSeasons(item as unknown as TMDBSeriesResult, name)}
                      onCancel={() => setRequesting(null)}
                    />
              )}
            />
          </div>
        )}
      </Surface>
    </main>
  );
}

function SearchTypeToggle({ value, onChange }: { value: SearchType; onChange: (v: SearchType) => void }) {
  return (
    <div role="tablist" aria-label="Search type" className="inline-flex rounded-full border border-border-subtle bg-surface p-1">
      {(['movie', 'tv'] as const).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt)}
            className={[
              'h-9 rounded-full px-4 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              active ? 'bg-accent text-accent-fg' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {opt === 'movie' ? 'Movies' : 'TV Shows'}
          </button>
        );
      })}
    </div>
  );
}

function MovieResultCard({
  movie, onJellyfin, isRequesting, onRequest, onSubmit, onCancel,
}: {
  movie: TMDBMovieResult;
  onJellyfin: boolean;
  isRequesting: boolean;
  onRequest: () => void;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
    : null;

  return (
    <Surface elevation="raised" className="flex gap-3 p-3 sm:gap-4">
      {posterUrl ? (
        <a href={`https://www.themoviedb.org/movie/${movie.id}`} target="_blank" rel="noopener noreferrer" className="block w-14 flex-shrink-0 sm:w-20">
          <Image src={posterUrl} alt={movie.title} width={80} height={120} className="h-auto w-full rounded-lg object-cover" />
        </a>
      ) : (
        <div className="h-[80px] w-14 flex-shrink-0 rounded-lg bg-surface sm:h-[120px] sm:w-20" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <a
              href={`https://www.themoviedb.org/movie/${movie.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-base font-semibold text-foreground hover:text-accent"
            >
              {movie.title}
            </a>
            <p className="text-xs text-muted-foreground">
              {getYear(movie.release_date)}
              {movie.genre_ids?.length ? ` · ${getGenreNamesDisplay(movie.genre_ids)}` : ''}
            </p>
          </div>
          {onJellyfin && <Pill variant="available" label="On Jellyfin" />}
        </div>
        {movie.overview && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{movie.overview}</p>
        )}
        <div className="mt-2">
          {!onJellyfin && !isRequesting && (
            <Button size="sm" onClick={onRequest}>Request</Button>
          )}
          {isRequesting && (
            <RequestForm isVisible onSubmit={onSubmit} onCancel={onCancel} />
          )}
        </div>
      </div>
    </Surface>
  );
}

function TvResultCard({
  show, availableSeasons, allSeasons, requesting, onRequestSeason, onRequestAll, onSubmitSeason, onSubmitAll, onCancel,
}: {
  show: TMDBSeriesResult;
  availableSeasons: number[];
  allSeasons: TMDBSeason[];
  requesting: string | null;
  onRequestSeason: (n: number) => void;
  onRequestAll: () => void;
  onSubmitSeason: (n: number, name: string) => Promise<void>;
  onSubmitAll: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const posterUrl = show.poster_path
    ? `https://image.tmdb.org/t/p/w185${show.poster_path}`
    : null;
  const regularSeasons = allSeasons.filter((s) => s.season_number > 0);
  const missing = regularSeasons.filter((s) => !availableSeasons.includes(s.season_number));
  const allDone = missing.length === 0 && regularSeasons.length > 0;

  return (
    <Surface elevation="raised" className="flex gap-3 p-3 sm:gap-4">
      {posterUrl ? (
        <a href={`https://www.themoviedb.org/tv/${show.id}`} target="_blank" rel="noopener noreferrer" className="block w-14 flex-shrink-0 sm:w-20">
          <Image src={posterUrl} alt={show.name} width={80} height={120} className="h-auto w-full rounded-lg object-cover" />
        </a>
      ) : (
        <div className="h-[80px] w-14 flex-shrink-0 rounded-lg bg-surface sm:h-[120px] sm:w-20" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div>
          <a
            href={`https://www.themoviedb.org/tv/${show.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-base font-semibold text-foreground hover:text-accent"
          >
            {show.name}
          </a>
          <p className="text-xs text-muted-foreground">
            {getYear(show.first_air_date)}
            {show.genre_ids?.length ? ` · ${getGenreNamesDisplay(show.genre_ids)}` : ''}
          </p>
        </div>

        {regularSeasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {regularSeasons.map((s) => {
              const available = availableSeasons.includes(s.season_number);
              const key = `${show.id}-${s.season_number}`;
              const isReq = requesting === key;
              return (
                <div key={s.season_number} className="flex items-center gap-1">
                  {available ? (
                    <Pill variant="available" label={`S${s.season_number}`} />
                  ) : isReq ? (
                    <RequestForm
                      isVisible
                      onSubmit={(name) => onSubmitSeason(s.season_number, name)}
                      onCancel={onCancel}
                    />
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => onRequestSeason(s.season_number)}>
                      S{s.season_number}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {missing.length > 0 && (
          <div className="mt-2">
            {requesting === `${show.id}-all` ? (
              <RequestForm isVisible onSubmit={onSubmitAll} onCancel={onCancel} />
            ) : (
              <Button size="sm" onClick={onRequestAll}>
                Request all missing ({missing.length})
              </Button>
            )}
          </div>
        )}

        {allDone && <p className="mt-2 text-xs text-emerald-400">All seasons available or requested</p>}
      </div>
    </Surface>
  );
}
