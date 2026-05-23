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

export interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface TMDBSimilarMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
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

export async function getTMDBMovieDetails(movieId: number): Promise<TMDBMovie> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not configured");
  }

  const response = await fetch(
    `${BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function getSimilarMovies(tmdbId: number): Promise<TMDBSimilarMovie[]> {
  if (!TMDB_API_KEY) {
    console.warn("Missing TMDB_API_KEY. Cannot fetch similar movies.");
    return [];
  }

  try {
    const res = await fetch(
      `${BASE_URL}/movie/${tmdbId}/similar?api_key=${TMDB_API_KEY}&language=en-US&page=1`,
      {
        headers: {
          accept: "application/json",
        },
        next: { revalidate: 86400 },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch similar movies: ${res.statusText}`);
    }

    const data = await res.json();
    return data.results || [];
  } catch (error) {
    console.error("Error fetching similar movies:", error);
    return [];
  }
}