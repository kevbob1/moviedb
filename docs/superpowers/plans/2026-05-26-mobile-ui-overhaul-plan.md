# Mobile-First UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dark mode, mobile-first responsive layouts, requestor name persistence, and PWA support to MovieDB

**Architecture:**
- Add `next-themes` ThemeProvider to handle dark/light mode toggle on `<html>` element
- Use Tailwind responsive utilities (`flex-col md:flex-row`, etc.) for mobile-first layouts
- localStorage for requestor name persistence with key `moviedb-requestor-name`
- PWA manifest + SVG favicon in public/

**Tech Stack:** next-themes, Tailwind CSS responsive utilities, localStorage

---

### Task 1: Install next-themes

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install next-themes package**

Run: `npm install next-themes`
Expected: package.json updated with `next-themes` in dependencies

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add next-themes for dark mode"
```

---

### Task 2: Create ThemeProvider component

**Files:**
- Create: `src/components/ThemeProvider.tsx`
- Modify: N/A (we'll wrap the app in layout.tsx in Task 3)

- [ ] **Step 1: Create ThemeProvider component**

```tsx
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ThemeProvider.tsx
git commit -m "feat: add ThemeProvider component with next-themes"
```

---

### Task 3: Add ThemeProvider, theme toggle, and PWA meta to layout

**Files:**
- Modify: `src/app/layout.tsx:1-41`

- [ ] **Step 1: Update layout.tsx imports and structure**

```tsx
import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Is It On Jellyfin?',
  description: 'Check if movies are available and request new ones',
  icons: {
    icon: '/favicon.svg',
  },
};
```

- [ ] **Step 2: Update body structure with ThemeProvider**

```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <header className="border-b border-gray-200 dark:border-gray-800">
            <div className="container mx-auto px-4 py-6 flex items-center">
              <div className="flex-1" />
              <Link
                href="/"
                className="text-3xl font-bold text-gray-900 dark:text-white hover:opacity-80 transition-opacity"
              >
                Is It On Jellyfin?
              </Link>
              <div className="flex-1 flex justify-end items-center gap-4">
                <ThemeToggle />
                <Link
                  href="/requests"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  View Requests
                </Link>
              </div>
            </div>
          </header>
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create ThemeToggle component**

Create `src/components/ThemeToggle.tsx`:

```tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-8 h-8" />;
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-2 rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Add PWA meta tags**

Add these inside `<head>` — since this is a server component, we'll use a dangerouslySetInnerHTML approach or add a separate metadata component. Actually, Next.js handles this better through the metadata object.

Update the metadata export in layout.tsx:

```tsx
export const metadata: Metadata = {
  title: 'Is It On Jellyfin?',
  description: 'Check if movies are on Jellyfin and request new ones',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MovieDB',
  },
};
```

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/components/ThemeProvider.tsx src/components/ThemeToggle.tsx
git commit -m "feat: add ThemeProvider, theme toggle, and PWA metadata"
```

---

### Task 4: Update search page with responsive layouts

**Files:**
- Modify: `src/app/page.tsx:99-204`

- [ ] **Step 1: Make search form responsive**

Find the form:
```tsx
<form onSubmit={handleSearch} className="mb-8">
```

Change to:
```tsx
<form onSubmit={handleSearch} className="mb-8 flex flex-col md:flex-row gap-2">
```

Update the input:
```tsx
<input
  type="text"
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  placeholder="Search for a movie..."
  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
/>
```

Update the button:
```tsx
<button
  type="submit"
  disabled={loading}
  className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50 md:w-auto w-full"
>
```

- [ ] **Step 2: Make movie cards responsive**

Find the movie card div:
```tsx
<div
  key={movie.id}
  className="bg-white dark:bg-gray-800 rounded-sm shadow-sm p-3 flex gap-4"
>
```

Change to:
```tsx
<div
  key={movie.id}
  className="bg-white dark:bg-gray-800 rounded-sm shadow-sm p-3 flex flex-col md:flex-row gap-4"
>
```

- [ ] **Step 3: Make Request button responsive**

Find:
```tsx
<button
  onClick={() => setRequesting(movie.id)}
  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-sm hover:bg-blue-700"
>
```

Change to:
```tsx
<button
  onClick={() => setRequesting(movie.id)}
  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-sm hover:bg-blue-700 w-full md:w-auto"
>
```

Note: The actual Request button that shows in the card needs to be full-width on mobile. The JellyfinBadge and title row already handle well.

Actually, let me re-read the layout more carefully. The "Request" button is at line 183-188. The card structure is:
- Movie card: flex row with poster + content
- Inside content: title row, overview, Request button

For mobile-first:
- Card should stack (poster top, content below)
- Request button should be full-width

Let me check the actual structure again and provide the correct edits.

Looking at lines 140-200 of src/app/page.tsx:

1. The card outer div (line 140-143) needs `flex-col md:flex-row`
2. The poster div (lines 144-156) already handled
3. The content div (lines 158-199) should stay as is
4. Request button (lines 182-188) needs `w-full md:w-auto`

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: apply responsive layout to search page"
```

---

### Task 5: Update requests page with responsive layouts

**Files:**
- Modify: `src/app/requests/page.tsx:52-77`

- [ ] **Step 1: Make page title responsive**

Find (line 54):
```tsx
<h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
```

Change to:
```tsx
<h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-900 dark:text-white">
```

- [ ] **Step 2: Commit**

```bash
git add src/app/requests/page.tsx
git commit -m "feat: apply responsive layout to requests page"
```

---

### Task 6: Add localStorage persistence to RequestForm

**Files:**
- Modify: `src/components/RequestForm.tsx:1-60`

- [ ] **Step 1: Add localStorage read on mount**

```tsx
'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'moviedb-requestor-name';

interface Props {
  onSubmit: (requestedBy: string) => void;
  onCancel: () => void;
  isVisible: boolean;
}

export function RequestForm({ onSubmit, onCancel, isVisible }: Props) {
  const [requestedBy, setRequestedBy] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setRequestedBy(stored);
    }
  }, []);

  if (!isVisible) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestedBy.trim()) {
      localStorage.setItem(STORAGE_KEY, requestedBy.trim());
      onSubmit(requestedBy.trim());
      setRequestedBy('');
    }
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-sm p-4 mt-3">
      <form onSubmit={handleSubmit}>
        <label htmlFor="requestedBy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Requested by (your name):
        </label>
        <input
          id="requestedBy"
          type="text"
          value={requestedBy}
          onChange={(e) => setRequestedBy(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Your name"
          required
        />

        <div className="flex flex-col md:flex-row gap-2 mt-3">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-sm hover:bg-blue-700 w-full md:w-auto"
          >
            Submit Request
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-sm hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 w-full md:w-auto"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RequestForm.tsx
git commit -m "feat: persist requestor name in localStorage"
```

---

### Task 7: Create PWA manifest.json

**Files:**
- Create: `public/manifest.json`

- [ ] **Step 1: Create manifest.json**

```json
{
  "name": "Is It On Jellyfin?",
  "short_name": "MovieDB",
  "description": "Check if movies are on Jellyfin and request new ones",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "/favicon.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    }
  ]
}
```

Note: For a proper PWA, you'd want PNG icons at 192x192 and 512x512. For this implementation, we'll use the SVG favicon as the icon source since browsers support SVG icons.

- [ ] **Step 2: Commit**

```bash
git add public/manifest.json
git commit -m "feat: add PWA manifest"
```

---

### Task 8: Create SVG favicon

**Files:**
- Create: `public/favicon.svg`

- [ ] **Step 1: Create film reel favicon**

A simple film reel/projection icon in SVG:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <circle cx="16" cy="16" r="14" stroke="#2563eb" stroke-width="2" fill="none"/>
  <circle cx="16" cy="16" r="5" fill="#2563eb"/>
  <circle cx="16" cy="6" r="2" fill="#2563eb"/>
  <circle cx="16" cy="26" r="2" fill="#2563eb"/>
  <circle cx="6" cy="16" r="2" fill="#2563eb"/>
  <circle cx="26" cy="16" r="2" fill="#2563eb"/>
  <circle cx="9" cy="9" r="2" fill="#2563eb"/>
  <circle cx="23" cy="23" r="2" fill="#2563eb"/>
  <circle cx="23" cy="9" r="2" fill="#2563eb"/>
  <circle cx="9" cy="23" r="2" fill="#2563eb"/>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add public/favicon.svg
git commit -m "feat: add SVG favicon"
```

---

### Task 9: Verify complete spec coverage

Review the spec and ensure all requirements are covered:

| Spec Requirement | Task |
|------------------|------|
| Dark mode via next-themes | Tasks 1-3 |
| ThemeProvider component | Task 2 |
| Theme toggle in header | Task 3 |
| Responsive search page | Task 4 |
| Responsive requests page | Task 5 |
| Requestor name localStorage | Task 6 |
| manifest.json | Task 7 |
| favicon.svg | Task 8 |

All covered.

---

### Task 10: Run validation

**Files:**
- N/A (validation only)

- [ ] **Step 1: Run full validation**

Run: `npm run check`
Expected: All checks pass (db:generate-client, lint, test, typecheck, build)

If any check fails, fix the issues and re-run until all pass.

- [ ] **Step 2: Commit final changes**

```bash
git add -A
git commit -m "feat: complete mobile-first UI overhaul with dark mode and PWA support"
```

---

## Plan Summary

| Task | Description |
|------|-------------|
| 1 | Install next-themes package |
| 2 | Create ThemeProvider component |
| 3 | Add ThemeProvider and toggle to layout, update metadata |
| 4 | Update search page with responsive layouts |
| 5 | Update requests page with responsive layouts |
| 6 | Add localStorage persistence to RequestForm |
| 7 | Create PWA manifest.json |
| 8 | Create SVG favicon |
| 9 | Verify spec coverage |
| 10 | Run validation and commit |
