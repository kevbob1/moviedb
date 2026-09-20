export interface TMDBMovie {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  genre_ids?: number[];
}

export interface TMDBSeries {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  first_air_date?: string;
  genre_ids?: number[];
}

export interface TMDBSeason {
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
  first_air_date?: string;
}

export interface TMDBTVDetailsResponse {
  id: number;
  name: string;
  seasons: TMDBSeason[];
  poster_path?: string | null;
  first_air_date?: string;
}

export interface TMDBMovieSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface TMDBTVSearchResponse {
  page: number;
  results: TMDBSeries[];
  total_pages: number;
  total_results: number;
}

export class TmdbError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'TmdbError';
  }
}

export interface TmdbAdapter {
  searchMovies(query: string): Promise<TMDBMovieSearchResponse>;
  searchTV(query: string): Promise<TMDBTVSearchResponse>;
  tvDetails(id: number): Promise<TMDBTVDetailsResponse>;
}

export interface TmdbClient {
  searchMovies(query: string): Promise<TMDBMovieSearchResponse>;
  searchTV(query: string): Promise<TMDBTVSearchResponse>;
  tvDetails(id: number): Promise<TMDBTVDetailsResponse>;
}

type Fetch = typeof fetch;

export class HttpTmdbAdapter implements TmdbAdapter {
  private readonly apiKey: string | undefined;
  private readonly fetchFn: Fetch;

  constructor(options: { apiKey?: string; fetch?: Fetch } = {}) {
    this.apiKey = options.apiKey ?? process.env.TMDB_API_KEY;
    this.fetchFn = options.fetch ?? fetch;
  }

  async searchMovies(query: string): Promise<TMDBMovieSearchResponse> {
    return this.request<TMDBMovieSearchResponse>(`/search/movie?query=${encodeURIComponent(query)}`);
  }

  async searchTV(query: string): Promise<TMDBTVSearchResponse> {
    return this.request<TMDBTVSearchResponse>(`/search/tv?query=${encodeURIComponent(query)}`);
  }

  async tvDetails(id: number): Promise<TMDBTVDetailsResponse> {
    return this.request<TMDBTVDetailsResponse>(`/tv/${id}`);
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.apiKey) throw new TmdbError('TMDB API key is not configured');
    const response = await this.fetchFn(`https://api.themoviedb.org/3${path}&api_key=${encodeURIComponent(this.apiKey)}`);
    if (!response.ok) throw new TmdbError(`TMDB API error: ${response.status} ${response.statusText}`, response.status);
    return response.json() as Promise<T>;
  }
}

export class InMemoryTmdbAdapter implements TmdbAdapter {
  constructor(private readonly data: {
    movies?: TMDBMovieSearchResponse;
    tv?: TMDBTVSearchResponse;
    details?: Record<number, TMDBTVDetailsResponse>;
  } = {}) {}

  async searchMovies(): Promise<TMDBMovieSearchResponse> {
    return this.data.movies ?? { page: 1, results: [], total_pages: 0, total_results: 0 };
  }

  async searchTV(): Promise<TMDBTVSearchResponse> {
    return this.data.tv ?? { page: 1, results: [], total_pages: 0, total_results: 0 };
  }

  async tvDetails(id: number): Promise<TMDBTVDetailsResponse> {
    const details = this.data.details?.[id];
    if (!details) throw new TmdbError(`TMDB TV details not found: ${id}`, 404);
    return details;
  }
}

export function createTmdbClient(options: { apiKey?: string; fetch?: Fetch } = {}): TmdbClient {
  const adapter = new HttpTmdbAdapter(options);
  return {
    searchMovies: (query) => adapter.searchMovies(query),
    searchTV: (query) => adapter.searchTV(query),
    tvDetails: (id) => adapter.tvDetails(id),
  };
}

// Compatibility wrappers for callers not yet migrated to the factory seam.
export async function searchTMDBMovies(query: string): Promise<TMDBMovie[]> {
  return (await createTmdbClient().searchMovies(query)).results;
}

export async function searchTMDBTV(query: string): Promise<TMDBSeries[]> {
  return (await createTmdbClient().searchTV(query)).results;
}

export function getTMDBTVDetails(id: number): Promise<TMDBTVDetailsResponse> {
  return createTmdbClient().tvDetails(id);
}
