# Similar Movies & Minimalist Redesign Spec

## Overview
This document outlines the design for adding a "Similar Movies" feature using the TMDB API and updating the application's visual style to a "Clean & Minimalist" aesthetic (moving away from an "AI-generated" look).

## Architecture & Data Flow

### TMDB Integration
- **Dependency:** TMDB (The Movie Database) API.
- **Environment:** Require `TMDB_API_KEY` in `.env`.
- **Server-Side Fetching:** API calls to TMDB will be made exclusively from Next.js React Server Components or API routes to prevent exposing the API key to the client.
- **Matching Mechanism:** If the local database stores TMDB IDs, we will use the `/movie/{movie_id}/similar` endpoint. If not, we will use the search endpoint to find the movie by title and year, extract its TMDB ID, and then fetch similar movies.

### Local Database Fallback
- When displaying similar movies, the UI will prioritize movies that already exist in our local Postgres database to ensure links work smoothly.
- If a recommended movie is not in our DB, we will either filter it out or present a visually distinct "Not in library" state.

## Components & UI

### `SimilarMovies` Component
- Located at the bottom of the movie detail page.
- Renders a clean grid (or horizontal scroll) of 5-10 recommended movies.
- Displays the movie poster, title, and year.

### Visual Style Refactor (Clean & Minimalist)
- **Removal of "AI Chrome":** Strip out gradients, excessive drop shadows, glowing borders, and overly rounded corners. Update Tailwind classes from `rounded-xl`/`rounded-2xl` to `rounded-sm` or `rounded-none`.
- **Layout:** Enforce a strict grid system with generous, consistent whitespace/margins (e.g., Letterboxd style).
- **Typography:** Implement high-contrast text sizing. Large, bold headers with simple, un-styled secondary text.
- **Color Palette:** Shift to a stark, neutral background (solid white or solid dark gray/black) allowing the movie posters to serve as the primary visual interest.
- **Movie Cards:** Redesign `MovieCard` components to be strictly minimalist: edge-to-edge poster with title and year placed directly below, without containing boxes or borders.

## Scope & Implementation Phases
1. **Style Cleanup:** Implement global CSS/Tailwind changes to remove the current UI chrome and establish the grid/typography foundation.
2. **TMDB Service:** Create a server-side utility/service to handle TMDB API communication and data mapping.
3. **Similar Movies UI:** Build the `SimilarMovies` component and integrate it into the movie detail page using the new service.
