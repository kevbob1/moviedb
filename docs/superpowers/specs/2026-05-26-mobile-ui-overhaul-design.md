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
- Remove hardcoded `dark:` Tailwind variant classes from all components — they should no longer be needed since all colors now come from CSS variables

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
7. Remove hardcoded `dark:` classes from all components (handled by ThemeProvider + CSS vars)
8. Add `.dark` class to CSS variables for dark mode state (ThemeProvider handles this)
9. Run validation: `npm run check`
