const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const BASE_URL = "https://api.themoviedb.org/3";

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

export interface TMDBSeries {
  id: number;
  name: string;
  overview?: string;
  first_air_date?: string;
  poster_path?: string;
  vote_average?: number;
  genre_ids?: number[];
}

export interface TMDBSeason {
  season_number: number;
  name: string;
  episode_count: number;
  poster_path?: string;
}

export interface TMDBSearchTVResponse {
  page: number;
  results: TMDBSeries[];
  total_pages: number;
  total_results: number;
}

export interface TMDBTVDetailsResponse {
  id: number;
  name: string;
  seasons: TMDBSeason[];
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export async function searchTMDBMovies(query: string): Promise<TMDBMovie[]> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not configured");
  }

  const response = await fetch(
    `${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  const data: TMDBSearchResponse = await response.json();
  return data.results;
}

export async function searchTMDBTV(query: string): Promise<TMDBSeries[]> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not configured");
  }

  const response = await fetch(
    `${BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  const data: TMDBSearchTVResponse = await response.json();
  return data.results;
}

export async function getTMDBTVDetails(tmdbId: number): Promise<TMDBTVDetailsResponse> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not configured");
  }

  const response = await fetch(
    `${BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}