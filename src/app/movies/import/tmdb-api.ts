const TMDB_API_KEY = process.env.TMDB_API_KEY || 'your_api_key_here';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export interface TMDBMovie {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  poster_path?: string;
  vote_average?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export async function searchTMDBMovies(query: string): Promise<TMDBMovie[]> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY is not configured');
  }

  const response = await fetch(
    `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  const data: TMDBSearchResponse = await response.json();
  return data.results;
}

export async function getTMDBMovieDetails(movieId: number): Promise<TMDBMovie> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY is not configured');
  }

  const response = await fetch(
    `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}