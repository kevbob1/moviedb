'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createRequest, createTvShowRequests } from '@/app/actions/request-actions';
import { RequestForm } from '@/components/RequestForm';
import { JellyfinBadge } from '@/components/JellyfinBadge';
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
    }
  };

  return (
    <main className="page-container">
      <h1 className="page-title">Search</h1>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => { setSearchType('movie'); setMovieResults([]); setTvResults([]); }}
          className={`px-4 py-2 rounded text-sm font-medium ${searchType === 'movie' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          Movies
        </button>
        <button
          type="button"
          onClick={() => { setSearchType('tv'); setMovieResults([]); setTvResults([]); }}
          className={`px-4 py-2 rounded text-sm font-medium ${searchType === 'tv' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          TV Shows
        </button>
      </div>

      <form onSubmit={handleSearch} className="form-row-lg">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search for a ${searchType === 'movie' ? 'movie' : 'TV show'}...`}
          className="input flex-1"
        />
        <button type="submit" disabled={loading} className="btn-primary btn-md">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className="alert-error">{error}</div>}
      {jellyfinError && <div className="alert-warning"><strong>Jellyfin Status:</strong> {jellyfinError}</div>}

      <div className="space-y-3">
        {currentResults.map((item) => {
          if (searchType === 'movie') {
            const movie = item as TMDBMovieResult;
            const onJellyfin = jellyfinResults[movie.id] || false;
            const reqKey = String(movie.id);
            const isRequesting = requesting === reqKey;

            return (
              <div key={movie.id} className="card-row">
                {movie.poster_path ? (
                  <a href={`https://www.themoviedb.org/movie/${movie.id}`} target="_blank" rel="noopener noreferrer" className="poster-sm">
                    <Image src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} alt={movie.title} width={64} height={96} className="poster-img" />
                  </a>
                ) : (
                  <div className="poster-sm bg-muted rounded-sm" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="card-title">
                        <a href={`https://www.themoviedb.org/movie/${movie.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {movie.title}
                        </a>
                        <span className="ml-2 text-sm font-normal text-year">{getYear(movie.release_date)}</span>
                      </h3>
                      {movie.genre_ids && movie.genre_ids.length > 0 && (
                        <p className="text-xs text-muted mb-1">{getGenreNamesDisplay(movie.genre_ids)}</p>
                      )}
                    </div>
                    <JellyfinBadge available={onJellyfin} />
                  </div>
                  {movie.overview && <p className="text-body line-clamp-2 mb-2">{movie.overview}</p>}
                  {!onJellyfin && !isRequesting && (
                    <button onClick={() => setRequesting(reqKey)} className="btn-primary btn-sm">Request</button>
                  )}
                  {isRequesting && (
                    <RequestForm isVisible={true} onSubmit={(requestedBy) => handleMovieRequest(movie, requestedBy)} onCancel={() => setRequesting(null)} />
                  )}
                </div>
              </div>
            );
          }

          const show = item as TMDBSeriesResult;
          const showId = show.id;
          const availableSeasons = jellyfinSeasons[showId] || [];
          const allSeasons = tmdbSeasons[showId] || [];
          const regularSeasons = allSeasons.filter(s => s.season_number > 0);
          const missingSeasons = regularSeasons.filter(s => !availableSeasons.includes(s.season_number));
          const hasRequestedAll = missingSeasons.length === 0 && regularSeasons.length > 0;

          return (
            <div key={show.id} className="card-row">
              {show.poster_path ? (
                <a href={`https://www.themoviedb.org/tv/${show.id}`} target="_blank" rel="noopener noreferrer" className="poster-sm">
                  <Image src={`https://image.tmdb.org/t/p/w185${show.poster_path}`} alt={show.name} width={64} height={96} className="poster-img" />
                </a>
              ) : (
                <div className="poster-sm bg-muted rounded-sm" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="card-title">
                      <a href={`https://www.themoviedb.org/tv/${show.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {show.name}
                      </a>
                      <span className="ml-2 text-sm font-normal text-year">{getYear(show.first_air_date)}</span>
                    </h3>
                    {show.genre_ids && show.genre_ids.length > 0 && (
                      <p className="text-xs text-muted mb-1">{getGenreNamesDisplay(show.genre_ids)}</p>
                    )}
                  </div>
                </div>
                {show.overview && <p className="text-body line-clamp-2 mb-2">{show.overview}</p>}

                {regularSeasons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {regularSeasons.map((season) => {
                      const isAvailable = availableSeasons.includes(season.season_number);
                      const reqKey = `${showId}-${season.season_number}`;
                      const isRequesting = requesting === reqKey;

                      return (
                        <div key={season.season_number} className="flex items-center gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            isAvailable ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-muted text-muted-foreground'
                          }`}>
                            S{season.season_number}
                          </span>
                          {!isAvailable && !isRequesting && (
                            <button
                              onClick={() => setRequesting(reqKey)}
                              className="btn-primary btn-xs text-xs px-2 py-0.5"
                            >
                              Request
                            </button>
                          )}
                          {isRequesting && (
                            <RequestForm
                              isVisible={true}
                              onSubmit={(requestedBy) => handleSeasonRequest(show, season.season_number, requestedBy)}
                              onCancel={() => setRequesting(null)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {missingSeasons.length > 0 && (
                  <div>
                    <button
                      onClick={() => setRequesting(`${showId}-all`)}
                      className="btn-primary btn-sm"
                    >
                      Request All Missing Seasons ({missingSeasons.length})
                    </button>
                    {requesting === `${showId}-all` && (
                      <RequestForm
                        isVisible={true}
                        onSubmit={(requestedBy) => handleRequestAllSeasons(show, requestedBy)}
                        onCancel={() => setRequesting(null)}
                      />
                    )}
                  </div>
                )}

                {hasRequestedAll && regularSeasons.length > 0 && (
                  <span className="text-xs text-green-600">All seasons already available or requested</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
