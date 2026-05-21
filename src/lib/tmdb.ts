// src/lib/tmdb.ts
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN || "";
const BASE_URL = "https://api.themoviedb.org/3";

export interface TMDBSimilarMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
}

export async function getSimilarMovies(tmdbId: number): Promise<TMDBSimilarMovie[]> {
  if (!TMDB_ACCESS_TOKEN) {
    console.warn("Missing TMDB_ACCESS_TOKEN. Cannot fetch similar movies.");
    return [];
  }

  try {
    const res = await fetch(
      `${BASE_URL}/movie/${tmdbId}/similar?language=en-US&page=1`,
      {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`
        },
        next: { revalidate: 86400 } // Cache for 24 hours
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