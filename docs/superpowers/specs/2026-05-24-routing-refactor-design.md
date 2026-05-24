# Routing Refactor Design

**Date:** 2026-05-24
**Scope:** Simplify routing structure by removing `/movies` prefix

## Problem Statement

The current routing structure has unnecessary nesting at the application root level:
- `/movies/import` - Movie search and request page

This route path is longer than needed and doesn't clearly indicate its purpose as a top-level search functionality.

## Goals

1. Simplify the routing structure by removing the `/movies` prefix
2. Move the movie search/request page to a top-level `/search` route
3. Improve URL clarity and navigation
4. Clean up unused route directories

## Proposed Changes

### Current Structure
```
src/app/
  layout.tsx (links to /movies/import)
  movies/
    import/
      page.tsx  → "Request a Movie" search page (searches TMDB, checks Jellyfin availability)
```

### Target Structure
```
src/app/
  layout.tsx (links to /search)
  search/
    page.tsx  → "Request a Movie" search page
```

## Implementation Details

### File Operations

**Move Operation:**
- `src/app/movies/import/page.tsx` → `src/app/search/page.tsx`

**Deletion:**
- `src/app/movies/` directory completely removed

**No Copies:**
- Source file moved, not duplicated

### Navigation Updates

**File:** `src/app/layout.tsx`

**Changes:**
1. Logo link: `/movies/import` → `/search`
2. Navigation button link: `/movies/import` → `/search`
3. Navigation button text: "+ Import Movie" → "Is it on Jellyfin?"

### API Routes

**No Changes Required:**
- `/api/tmdb/search` remains unchanged at its current location
- No dependent routes to update

### Component Functionality

**No Changes to Page Component:**
- The page component (`src/app/search/page.tsx`) will be identical after the move
- All functionality preserved:
  - TMDB movie search via `/api/tmdb/search`
  - Jellyfin availability check
  - Request form and submission
  - All client-side state and handlers

### Impact Analysis

**Code References Found:**
- `src/app/layout.tsx` - Line 20: Logo link to /movies/import
- `src/app/layout.tsx` - Line 25: Navigation button link to /movies/import

**Other References:**
- No external links or bookmarked URLs in codebase
- Component tests reference page structure, not URL paths
- No E2E test files reference this specific route

**Breaking Changes:**
- Internal application links will change
- No need for backward compatibility redirects
- External-facing URLs not affected (app is internal)

## Testing Considerations

**No New Tests Required:**
- Existing component tests will pass with path changes
- No tests specifically test route paths

**Manual Testing:**
- Verify `/search` route loads correctly
- Verify navigation from header still points to `/search`
- Verify TMDB search and Jellyfin checks still work
- Verify request submission still functions

## Trade-offs

**Chosen Approach: Simple Move**

Alternative considered:
- **Move with 301 redirect:** Add redirect from `/movies/import` to `/search`
  - Pros: Better for bookmarked URLs
  - Cons: Additional maintenance burden, unnecessary complexity for external use
  - Decision: Not needed as app is internal

**Benefits:**
- Cleaner, shorter URLs
- More intuitive route path
- Removes unnecessary directory nesting
- No backward compatibility maintenance

**Potential Future Considerations:**
- If additional movie-related routes are needed (e.g., `/movies/[id]`), could be added back as `/movie/[id]` or kept under `/search` with different sub-routes
- Current design doesn't preclude future additions

## Success Criteria

- [ ] `/movies/import` redirects to `/search` (via delete/new file)
- [ ] Navigation header links to `/search` work correctly
- [ ] Logo link to `/search` works correctly
- [ ] TMDB search functionality still works
- [ ] Jellyfin availability check still works
- [ ] Movie request form submission still works
- [ ] No TypeScript errors or build failures
- [ ] All linting passes

## Implementation Notes

Files to be modified:
1. `src/app/search/page.tsx` - new file (move from `src/app/movies/import/page.tsx`)
2. `src/app/layout.tsx` - update 3 links in the header

Files to be deleted:
1. `src/app/movies/` directory
2. `src/app/movies/import/page.tsx` (after move)

No migration files or database changes required.