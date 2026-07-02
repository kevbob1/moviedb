# MovieDB UI Overhaul — Design Spec

**Date:** 2026-07-02
**Status:** Draft for review
**Scope:** Full UI/UX redesign of all client-facing surfaces

---

## 1. Goals

1. **Mobile-first**: every layout, component, and interaction designed for narrow viewports first, enhanced for larger screens.
2. **Progressive enhancement** (interpreted as **mobile-first + accessibility**): resilient to small screens, slow networks, and assistive tech. JS may be required for interactive features, but core content is server-rendered and accessible without JS.
3. **Clear buttons & animations**: 44×44px minimum touch targets, expressive Motion animations that respect `prefers-reduced-motion`.
4. **Coherent visual language**: replace the ad-hoc blue/grey Tailwind defaults with a deliberate design system.

### Non-goals

- No new product features.
- No backend changes (API routes unchanged).
- No light theme (dark only).
- No framework migration (Next.js 16 + React 19 stay).

---

## 2. Visual Direction — "Warm Cinema"

| Aspect | Choice |
|---|---|
| Mood | Cinematic, relaxed, "Friday night" |
| Surface | Charcoal (`#0c0a09` → `#1c1917` gradient) |
| Accent | Amber (`#f59e0b` primary, `#fbbf24` hover) |
| Type | Inter (UI), Instrument Serif (italic headlines) |
| Shape | 12–14px radius, soft borders, subtle shadows |
| Density | Comfortable, generous spacing on mobile |

### Color tokens (replaces existing `:root` / `.dark`)

```
--background:       24 10% 5%   (#0c0a09)
--surface:          24 9% 11%   (#1c1917)
--surface-elevated: 24 8% 16%   (#292524)
--border:           24 6% 26%   (#44403c)
--border-subtle:    24 6% 18%   (#2a2724)
--foreground:       60 9% 98%   (#fafaf9)
--muted-foreground: 24 5% 64%   (#a8a29e)
--accent:           38 92% 50%  (#f59e0b)
--accent-hover:     38 95% 60%  (#fbbf24)
--accent-fg:        24 10% 9%   (#1c1917)
--success:          142 71% 45% (#22c55e)
--success-bg:       142 71% 16%
--warning:          38 92% 50%
--danger:           0 72% 51%
```

### Type scale

- `display`: 2rem–2.25rem italic serif (hero copy)
- `h1`: 1.5rem semibold sans
- `h2`: 1.25rem semibold
- `body`: 0.875rem regular
- `caption`: 0.75rem medium uppercase tracking (section labels)
- Line height: 1.15 (display), 1.4 (headings), 1.5 (body)

---

## 3. Architecture

### Token layer
- All colors / radii / shadows / motion durations live as CSS custom properties in `src/app/globals.css` under `@theme` (Tailwind v4 CSS-first config).
- Tailwind utility classes generated from these tokens; component classes (`.btn-primary`, etc.) replaced by CVA variants.

### Component layer
- New directory `src/components/ui/` for primitive components (Button, Input, Pill, Spinner, Surface).
- Existing `src/components/*.tsx` rebuilt using primitives; behaviour preserved.
- Variants via `class-variance-authority` (already a dep).
- Accessible primitives via Radix UI (already a dep) only where needed (e.g. Tooltip, Popover for future).

### Motion layer
- New dep: `motion` (the new name of Framer Motion).
- New `src/components/motion/` with shared variants (fade-up entrance, stagger, scale-tap, page-transition).
- All variants read from `--motion-duration-*` and `--motion-ease-*` tokens; `prefers-reduced-motion` handled at the variant level (no-op when reduced).

### Page structure
- `src/app/layout.tsx` — root shell: header, main, footer. Sticky header on scroll.
- `src/app/page.tsx` (Search) — "two-thirds hero" layout, see §4.
- `src/app/requests/page.tsx` (Requests) — "horizontal row" list, see §5.
- `src/app/components/Navigation.tsx` — refactored to icon-first on mobile, label+icon on ≥sm.
- New: `src/app/components/PageTransition.tsx` — wraps children with Motion route transition.

### Mobile-first breakpoints
- Base styles = mobile (≤640px).
- `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.
- Containers capped at 720px content width for legibility; centered on larger screens.

### Touch targets
- All interactive elements ≥ 44×44px.
- Inline links inside paragraphs stay default; primary buttons / list rows / nav items are oversized.
- `padding: 12px 16px` minimum on buttons.

---

## 4. Home Page (Search) — Two-thirds Hero

### Layout

```
┌──────────────────────────────┐
│  Header (sticky)             │
├──────────────────────────────┤
│  ● Live                      │  ← caption
│                              │
│  What's on tonight?          │  ← display italic
│                              │
├──────────────────────────────┤
│  Search panel (elevated)     │
│  ┌────────────────────────┐  │
│  │ 🔍  Search a title…    │  │
│  └────────────────────────┘  │
│  [ Search ] [ 🎲 ]           │
│                              │
│  (Results appear below)      │
│  ┌────────────────────────┐  │
│  │ 🎬  Title              │  │
│  │ 2024 · Sci-Fi          │  │
│  │ [ On Jellyfin ]        │  │
│  │ [ Request ]            │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

- Top ⅓: hero copy block (centered, padded). On mobile, the eyebrow + headline only.
- Bottom ⅔: search panel (elevated surface, 16px radius, soft shadow). Search results slide in below the search bar inside the same panel.
- Result cards use the same horizontal-row component as the requests list (consistency).

### Behaviour
- Movies/TV toggle: pill segmented control above the search input (preserves existing `searchType` state).
- Search submits on Enter or button click. Results enter with `staggerChildren: 0.05`.
- Empty state: subtle "Try a title, year, or TMDB id…" placeholder hint.
- Error state: amber-bordered card with retry button.
- Loading state: spinner in search button; results panel shows 3 skeleton rows.

### Animation
- Initial page load: hero copy fades up (200ms, 8px Y), search panel fades up 100ms after (staggered).
- Result entry: each card fades up + slight Y (12px), 250ms, 40ms stagger.
- Button press: scale 0.97, 100ms.
- All gated on `prefers-reduced-motion: no-preference`.

---

## 5. Requests Page — Horizontal Row List

### Layout

```
┌──────────────────────────────┐
│  Header                      │
├──────────────────────────────┤
│  Requests         3 open     │  ← h1 + caption
│                              │
│  [☐] Show fulfilled           │  ← styled checkbox
│                              │
│  ┌──────────────────────────┐│
│  │ [poster] Title           ││
│  │          2024 · Sci-Fi   ││
│  │          ● Pending       ││
│  │          Requested 2h ago││
│  │                  ›       ││
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │ [poster] Title           ││
│  │          …               ││
│  └──────────────────────────┘│
│                              │
│      [ Previous  1/3  Next ] │
└──────────────────────────────┘
```

- Card: 56×80px poster (mobile) / 72×108 (sm+) on left, info centre, chevron on right.
- Status pill (top-right of info area, or inline with metadata for compact rows).
- Row is a `<button>` element (whole row clickable to open detail/expand on mobile).
- Touch target: full row ≥ 88px tall.

### Behaviour
- Pagination preserved (server-rendered with URL params).
- "Show fulfilled" toggle: same URL-param pattern, restyled as a Radix Switch primitive for larger tap target + animation.
- Empty state: centered illustration placeholder + "No requests yet — search to add one" with link.
- Row actions (fulfill / download / cancel): appear as action sheet on row tap (mobile) or inline buttons (sm+).
- Cancellation: swipe-to-dismiss optional v2; v1 = action sheet with confirm.

### Animation
- List entry: cards fade up + Y, 60ms stagger (expressive).
- Row tap: scale 0.98 + amber border glow (Motion `whileTap`).
- Status pill changes: subtle pulse on transition (yellow → green = "fulfilled").

---

## 6. Component Specs

### Button (CVA variants)
- Variants: `primary` (amber), `secondary` (surface-elevated), `ghost` (transparent), `danger` (red), `success` (green).
- Sizes: `sm` (36px), `md` (44px — default), `lg` (52px).
- States: default, hover (lighten + 1px translate-y), active (scale 0.97), disabled (opacity 50%), loading (spinner replaces label).
- Icon-only variant: 44×44 square.
- Always `aria-busy` when loading; spinner has `aria-label`.

### Input
- Height 48px, radius 12px, surface background, border on focus (amber 2px ring).
- Search input variant: 52px, larger icon slot.
- Inline label above (caption style) — never placeholder-only.

### Pill (status)
- Variants: `pending` (amber), `downloading` (blue), `fulfilled` (green), `canceled` (red), `available` (green outline).
- Dot indicator prefix (8px circle) + label.
- 24px height, 10px radius-full, caption font.

### Surface
- Three elevation levels: `base` (page bg), `raised` (cards), `overlay` (modals/sheets).
- Soft shadow on raised/overlay; 1px border in addition.

### Spinner
- Replaces existing `.spinner`. Uses `currentColor` for theming.
- `aria-label="Loading"`, decorative SVGs hidden from a11y tree.

### Navigation
- Mobile: icon-only links, 48×48 touch target. Active state: amber underline indicator.
- ≥sm: icon + label.
- Hamburger menu: not needed (only 2 nav items, fits inline even on mobile).

### Header
- Sticky, backdrop-blur on scroll (8px blur, 70% opacity).
- Logo: text "Jellyfin" with amber dot prefix.
- Right side: nav items + (future) theme toggle slot.

### PageTransition
- Wraps page content. On route change: fade 200ms in.
- Disabled when `prefers-reduced-motion: reduce`.

---

## 7. Motion Tokens

```
--motion-duration-instant: 100ms
--motion-duration-fast:    150ms
--motion-duration-base:    250ms
--motion-duration-slow:    400ms
--motion-ease-standard:    cubic-bezier(0.4, 0, 0.2, 1)
--motion-ease-emphasized:  cubic-bezier(0.2, 0, 0, 1)
--motion-ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1)
```

Variants:

```ts
fadeUp:     { opacity: 0→1, y: 12→0, duration: 250, ease: 'standard' }
stagger:    { staggerChildren: 0.04–0.06 }
scaleTap:   { scale: 1→0.97, duration: 100 }
pulse:      { scale: 1→1.05→1, duration: 400, ease: 'spring' }
```

`useReducedMotion()` hook short-circuits all variants to no-op when user prefers reduced motion.

---

## 8. Accessibility

- **Contrast**: amber on charcoal = 7.2:1 (AAA). White on charcoal = 17:1 (AAA). Verify all foreground/background pairs.
- **Focus**: visible 2px amber focus ring on all interactive elements. Never `outline: none` without replacement.
- **Tap targets**: ≥44×44px (buttons, list rows, nav). Verify with browser dev tools.
- **Screen reader**: status pills have `aria-label="Status: pending"`; loading spinners have `aria-label="Loading"`.
- **Keyboard**: all interactive elements reachable via Tab; Enter/Space activate; Escape closes any overlays.
- **Live regions**: search results announce "12 results found" via `aria-live="polite"`.
- **Touch action**: `touch-action: manipulation` on buttons to prevent 300ms double-tap delay.

---

## 9. Performance

- Motion library tree-shakable; import only `motion` package (~30KB gz) — not `framer-motion` legacy.
- Initial CSS unchanged in size (Tailwind v4 already purges).
- New fonts: load Inter (variable, 1 file) and Instrument Serif (1 file) via `next/font` with `display: swap`.
- No new client JS for server components; Motion only loaded on pages that need it (lazy import in `PageTransition`).

---

## 10. Testing

### Unit / component tests (Jest + Testing Library)
- Each new primitive (Button, Pill, Surface, etc.) has tests for variants, states, a11y attributes.
- Existing `RequestList`, `RequestCard`, `RequestForm`, `ShowFulfilledCheckbox` tests updated to new structure.
- New: `PageTransition` renders children and respects `prefers-reduced-motion` (jsdom mock).

### Integration / e2e
- Search → result → request flow (existing e2e tests updated).
- Requests page filter + pagination.
- Header navigation across pages.
- Visual regression via Playwright screenshot diff (optional, can be added later).

### Manual checks
- Mobile viewport (375×667) — every page.
- Keyboard-only navigation.
- VoiceOver / NVDA spot checks.
- `prefers-reduced-motion: reduce` — no animation, same usability.

---

## 11. Migration Strategy

Phased, each phase ships and verifies before next:

1. **Phase 1 — Foundation** (palette swap, no layout change):
   - Add Motion dep.
   - Replace `globals.css` color token values with Warm Cinema palette (class names and layouts unchanged; only the colour values behind them change).
   - Add `Button`, `Pill`, `Surface`, `Input`, `Spinner` primitives in `src/components/ui/` (new components, not yet wired into pages).
   - Add motion variants in `src/components/motion/`.
   - Add `PageTransition` wrapper (not yet applied).

2. **Phase 2 — Header + Layout**:
   - Rebuild `src/app/layout.tsx` with new header (sticky, backdrop-blur).
   - Refactor `Navigation` (icon-first mobile).
   - Apply new font (Instrument Serif + Inter via `next/font`).
   - Wrap `{children}` in `PageTransition`.

3. **Phase 3 — Home page**:
   - Restructure to two-thirds hero.
   - Migrate search form to new `Input` + `Button` primitives.
   - Migrate result rows to new card component.
   - Add staggered entry animation.

4. **Phase 4 — Requests page**:
   - Restyle request list to horizontal row.
   - Migrate `RequestCard` to use new primitives.
   - Style "Show fulfilled" as Radix Switch.
   - Add list entry stagger.

5. **Phase 5 — Polish**:
   - Empty states, error states, loading skeletons.
   - Focus ring audit.
   - Reduced-motion audit.
   - Bundle size check.

Each phase: run `npm run check` (lint, test, typecheck, build) inside devcontainer before merging.

---

## 12. Open Questions

None at time of writing. All decisions made during brainstorming.

---

## 13. File Inventory (planned changes)

### New
- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Pill.tsx`
- `src/components/ui/Surface.tsx`
- `src/components/ui/Spinner.tsx`
- `src/components/ui/Switch.tsx`
- `src/components/motion/variants.ts`
- `src/components/motion/PageTransition.tsx`
- `src/components/motion/StaggerList.tsx`
- `src/lib/cn.ts` (clsx + tailwind-merge helper)
- `src/lib/motion.ts` (useReducedMotion re-export + token hook)

### Modified
- `src/app/globals.css` (token overhaul)
- `src/app/layout.tsx` (new header, fonts, PageTransition)
- `src/app/page.tsx` (restructure to two-thirds hero)
- `src/app/requests/page.tsx` (restyle list, switch)
- `src/app/components/Navigation.tsx` (icon-first)
- `src/app/components/Pagination.tsx` (new Button)
- `src/components/RequestCard.tsx` (rebuild using primitives)
- `src/components/RequestForm.tsx` (rebuild)
- `src/components/RequestList.tsx` (restyle, add stagger)
- `src/components/RequestListItem.tsx` (logic-only refactor)
- `src/components/JellyfinBadge.tsx` → rename/replace with `Pill`
- `src/components/ShowFulfilledCheckbox.tsx` (use Switch)

### Removed
- Old `.btn-primary`, `.btn-secondary`, `.btn-md`, `.card`, `.card-row`, `.alert-error`, `.alert-warning`, `.alert-request`, `.badge-success` from `globals.css` (replaced by primitives).

### Unchanged
- All API routes (`/api/**`).
- All server actions.
- Database schema and migrations.
- Helm chart (no env changes).
- Devcontainer config.
