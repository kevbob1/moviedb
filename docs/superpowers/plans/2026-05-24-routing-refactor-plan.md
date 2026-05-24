# Routing Refactor Implementation Plan

**For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move movie search page from `/movies/import` to top-level `/search` route

**Architecture:** Simple file move and reference update. Move the page component to a new `src/app/search/` directory, update layout navigation links, delete the old `/movies/` directory.

**Tech Stack:** Next.js 16, React 19, TypeScript

---

## File Structure

### Files to Create
- `src/app/search/page.tsx` - Movie search/request page component (moved from `src/app/movies/import/page.tsx`)

### Files to Modify
- `src/app/layout.tsx` - Update navigation links (logo and "+ Import Movie" button) and text

### Files to Delete
- `src/app/movies/` directory (entire directory)
- `src/app/movies/import/page.tsx` (after successful move)

## Task Decomposition

### Task 1: Move Page Component

**Files:**
- Create: `src/app/search/page.tsx`
- Delete: `src/app/movies/import/page.tsx`

- [ ] **Step 1: Copy page component to new location**
  ```bash
  cp src/app/movies/import/page.tsx src/app/search/page.tsx
  ```

- [ ] **Step 2: Verify copy was successful**
  Run: `ls -la src/app/search/page.tsx`
  Expected: File exists with same content

- [ ] **Step 3: Verify original directory structure still exists**
  Run: `ls -la src/app/movies/`
  Expected: Directory exists with import/ subdirectory

- [ ] **Step 4: Commit the copy**
  ```bash
  git add src/app/search/page.tsx
  git commit -m "refactor: move movie search page to /search route"
  ```

- [ ] **Step 5: Delete original page component**
  ```bash
  rm src/app/movies/import/page.tsx
  ```

- [ ] **Step 6: Commit the deletion**
  ```bash
  git add src/app/movies/
  git commit -m "refactor: remove /movies/import directory"
  ```

### Task 2: Update Layout Navigation

**Files:**
- Modify: `src/app/layout.tsx:20,25`

- [ ] **Step 1: Update logo link**
  Find this line in `src/app/layout.tsx`:
  ```tsx
  <Link href="/movies/import" className="text-2xl font-bold text-gray-900 dark:text-white">
  ```
  Replace with:
  ```tsx
  <Link href="/search" className="text-2xl font-bold text-gray-900 dark:text-white">
  ```

- [ ] **Step 2: Update navigation button link**
  Find this line in `src/app/layout.tsx`:
  ```tsx
  href="/movies/import"
  ```
  Change to:
  ```tsx
  href="/search"
  ```

- [ ] **Step 3: Commit navigation updates**
  ```bash
  git add src/app/layout.tsx
  git commit -m "refactor: update navigation links to /search route"
  ```

### Task 3: Verify Application Functionality

**Files to check:**
- No code changes required, just verification steps

- [ ] **Step 1: Run typecheck**
  Run: `npm run typecheck`
  Expected: No TypeScript errors

- [ ] **Step 2: Run linter**
  Run: `npm run lint`
  Expected: No linting errors

- [ ] **Step 3: Build the application**
  Run: `npm run build`
  Expected: Build succeeds

- [ ] **Step 4: Verify `/search` route renders**
  Run: `npm run dev` in separate terminal
  Navigate to http://localhost:3000/search
  Expected: Page loads with movie search functionality

- [ ] **Step 5: Verify navigation works**
  Check header logo and "+ Search" button links
  Expected: Both link to http://localhost:3000/search

### Task 4: Final Cleanup

- [ ] **Step 1: Verify `movies/` directory is deleted**
  Run: `ls -la src/app/ | grep movies`
  Expected: No output (directory should not exist)

- [ ] **Step 2: Run full verification suite**
  Run: `npm run typecheck && npm run lint && npm run build`
  Expected: All pass

- [ ] **Step 3: Test movie search functionality**
  1. Search for a movie (e.g., "Inception")
  2. Verify TMDB API fetch works
  3. Verify Jellyfin availability check works
  4. Verify request form submission works
  Expected: All functionality works as before

- [ ] **Step 4: Final commit**
  ```bash
  git add src/app/
  git commit -m "refactor: complete routing structure simplification to /search"
  ```

## Testing Checklist

- [ ] `/search` route renders correctly
- [ ] Logo links to `/search`
- [ ] "+ Search" button links to `/search`
- [ ] Movie search via TMDB API works
- [ ] Jellyfin availability check works
- [ ] Movie request form submission works
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Application builds successfully
- [ ] `/movies/` directory has been deleted

## Rollback Plan

If issues arise, rollback with:
```bash
git revert HEAD~4..HEAD
```

This will reverse all four commits:
1. "refactor: move movie search page to /search route"
2. "refactor: remove /movies/import directory"
3. "refactor: update navigation links to /search route"
4. "refactor: complete routing structure simplification to /search"

Then restore from backup if needed.