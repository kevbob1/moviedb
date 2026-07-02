# ADR-0002: Warm Cinema Visual Direction

## Status

Accepted (2026-07-02). Implementation pending — see execution spec at `docs/superpowers/specs/2026-07-02-ui-overhaul-design.md` §3–§7 for the rollout plan. The spec stays as the working document for the 5-phase migration; this ADR captures the decisions that should outlive the spec.

## Context

The current client UI uses ad-hoc Tailwind defaults (blue/grey palette, system fonts, generic button styles). The result is functional but generic: nothing in the visual language says "this is a movie app for a Friday night." Typography and spacing are inconsistent across pages.

The full design rationale (token values, type scale, layout sketches) lives in the spec. This ADR extracts the *decisions* — the parts that should bind future work even if the specific hex codes shift.

## Decision

- **Mood**: cinematic, relaxed, "Friday night." Not playful, not corporate, not generic-blue. The visual reference is a darkened living room, not a SaaS dashboard.
- **Dark only.** No light theme. No theme toggle. Dark is the only theme.
- **Surface palette**: charcoal gradient from `#0c0a09` (background) through `#1c1917` (surface) to `#292524` (elevated). Border tones in the same hue family (`#44403c`, `#2a2724`).
- **Accent**: amber (`#f59e0b` primary, `#fbbf24` hover). Amber on charcoal contrast = 7.2:1 (AAA). Amber is the only chromatic accent; everything else is neutral.
- **Typography**:
  - UI: **Inter** (variable, single file via `next/font`)
  - Display headlines: **Instrument Serif** italic
  - Display only on hero copy and pull-quotes, never on body text.
- **Shape**: 12–14px radii. Soft borders. Subtle shadows on raised/overlay surfaces.
- **Density**: comfortable. Generous spacing on mobile. Containers capped at 720px content width for legibility.
- **No light theme. No framework migration.** Tailwind v4 + CSS-first `@theme` config stays.

## Consequences

- Every UI PR must conform to the charcoal/amber palette. New accent colours require updating this ADR (or a successor).
- Display font (Instrument Serif) is reserved for hero copy. Misuse (e.g. putting it on body text) violates the visual language.
- Tailwind v4 `@theme` block in `src/app/globals.css` is the canonical source of design tokens. Component code reads tokens, never raw hex values.
- Any new component, page, or layout that doesn't reference the token system should be rejected in review.
- The "no light theme" rule blocks future work on theme toggles, OS-following colour schemes, or high-contrast variants. A future ADR would be required to revisit.

## Non-goals (from the spec, restated for binding)

- No new product features.
- No backend changes — all `/api/**` routes unchanged.
- No framework migration — Next.js 16 + React 19 stay.
- No light theme (see above).

## Alternatives considered

- **Light + dark themes with a toggle.** Rejected: doubles the design-token surface, complicates Motion variants, and the user has explicitly chosen dark-only. A toggle can be added later via a successor ADR if needed.
- **Multiple accent colours** (e.g. per-genre). Rejected: dilutes the cinematic mood; introduces accessibility re-checks for every new pair.
- **System font stack instead of Inter.** Rejected: Inter's tabular numbers and metric stability matter for the data-heavy Requests page.
- **Stick with the ad-hoc blue/grey.** Rejected: the visual language is the app's identity; generic blue is the opposite of "Friday night."
