# Mobile-First UI Overhaul with Dark Mode

## Overview

Redesign the MovieDB UI to work well on mobile devices while maintaining desktop usability. Add proper dark mode support via `next-themes` and persist the requestor name in localStorage.

## 1. Dark Mode Infrastructure

- Install `next-themes` package
- Create a `ThemeProvider` component that wraps the app with Next.js `next-themes` integration
- The ThemeProvider will handle:
  - Toggling the `dark` class on `<html>` based on user preference
  - Persisting the user's theme choice (system, light, or dark)
  - Synchronizing with the existing CSS variables for background, foreground, muted, etc.
- Add a theme toggle button to the header (sun/moon icon) so users can switch modes
- Keep existing `dark:` Tailwind variant classes — they work with ThemeProvider's `dark` class on `<html>`

## 2. Mobile-First Responsive Layout

### Search Page (src/app/page.tsx)

| Element | Mobile (<md) | Desktop (md+) |
|---------|---------------|---------------|
| Search form | Stack vertically (input full width, button below) | Inline (input + button in row) |
| Movie card | Flex column (poster above, text below) | Flex row (poster left, text right) |
| Request button | Full-width, pill-shaped | Right-aligned, standard |
| Request form | Stacked, full-width inputs | Standard margins |

### Requests Page (src/app/requests/page.tsx)

| Element | Mobile (<md) | Desktop (md+) |
|---------|---------------|---------------|
| Page title | text-2xl | text-3xl |
| Cards | Full-width, tighter padding | Standard padding |
| Pagination | Smaller text, tighter spacing | Standard |

## 3. Requestor Name Persistence

Modify `RequestForm.tsx`:

- On component mount, read `requestedBy` from `localStorage` (`key: "moviedb-requestor-name"`)
- If found, pre-fill the input field
- On successful form submission, save the `requestedBy` value to `localStorage`
- Clear the localStorage only if user explicitly clears the field (not on cancel)

## 4. Responsive Implementation Approach

Use Tailwind responsive utilities with mobile-first breakpoints:

- Base styles target mobile (small screens, touch-friendly)
- Add `md:` prefixed styles for desktop overrides
- Key utilities: `flex-col md:flex-row`, `w-full md:w-auto`, `block md:inline-block`

## Tasks

1. Install `next-themes` package
2. Create `ThemeProvider` component wrapping the app
3. Add theme toggle to header
4. Update search page with responsive layouts
5. Update requests page with responsive layouts
6. Update `RequestForm` with localStorage persistence
7. Keep existing `dark:` Tailwind classes (work with ThemeProvider's `dark` class)
8. Run validation: `npm run check`

## 5. PWA Mobile Features

Add basic Progressive Web App support for mobile installability:

### Web App Manifest

Create `public/manifest.json`:
- `name`: "Is It On Jellyfin?"
- `short_name`: "MovieDB"
- `description`: "Check if movies are on Jellyfin and request new ones"
- `start_url`: "/"
- `display`: "standalone"
- `background_color`: "#ffffff" (and dark variant via `prefers-color-scheme`)
- `theme_color`: "#2563eb" (primary blue)
- `icons`: array with at least 192x192 and 512x512 PNG icons
- Point icons to SVG files in `public/`

### Favicon

Create SVG favicon (`public/favicon.svg`):
- Simple film/reel icon or the "Is It On Jellyfin?" brand mark
- Use the primary blue (#2563eb) as the icon color

### Metadata

Add to `src/app/layout.tsx`:
- Link to manifest: `<link rel="manifest" href="/manifest.json" />`
- Theme color meta tag: `<meta name="theme-color" content="#2563eb" />`
- Apple mobile web app capable: `<meta name="apple-mobile-web-app-capable" content="yes" />`

## Tasks (cont.)

9. Create `public/manifest.json` with PWA metadata
10. Create `public/favicon.svg` with film/reel icon
11. Add manifest and PWA meta tags to `layout.tsx`
12. Run validation: `npm run check`
