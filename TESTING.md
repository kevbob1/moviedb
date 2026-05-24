# Manual Verification Instructions for /search Route

## Required Manual Testing

After the E2E tests, manual verification should be performed with the following steps:

### 1. Start Development Server
```bash
npm run dev
```

### 2. Verify Page Renders
- Navigate to http://localhost:3000/search
- Verify the page loads without console errors
- Check that the heading "Request a Movie" is visible

### 3. Verify Search Functionality
- Type a movie name in the search box
- Click the Search button
- Verify that search results appear (if a backend query is made)
- Verify error handling (try an invalid search term)

### 4. Verify Request Movie Functionality
- Click the "Request" button on a search result
- Verify the Request Form is displayed
- Fill out the form and submit
- Verify the request is recorded

### 5. Check Jellyfin Integration
- Verify Jellyfin badges appear on movies that are available on Jellyfin
- Verify Jellyfin badges are hidden on movies not available

## Test Results

### Automated E2E Tests
✓ All 4 E2E tests for /search route passed
- Page rendering verification
- Text input functionality
- Form button presence
- Grid structure verification

### Manual Testing Checklist
[ ] Development server starts without errors
[ ] Page loads correctly at http://localhost:3000/search
[ ] "Request a Movie" heading is visible
[ ] Search functionality works (with backend)
[ ] Request form interaction works
[ ] Jellyfin badge integration works

## Notes

- Manual testing should be performed by a QA engineer or developer
- Environmental variables must be properly configured
- Database must be accessible
- TMDB API access must be working
- Jellyfin server must be accessible