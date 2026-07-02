# ADR-0003: Mobile-First + Accessibility Baseline

## Status

Accepted (2026-07-02). Implementation pending — see execution spec at `docs/superpowers/specs/2026-07-02-ui-overhaul-design.md` for the rollout plan.

## Context

The current UI was not designed mobile-first. Several touch targets are sub-40px, there is no systematic `prefers-reduced-motion` handling, and focus styles are inconsistent. The user base includes people with older phones, slow networks, and assistive tech.

Accessibility is treated as a floor, not a polish step. It's the default contract every component ships under, not something added at the end of a feature.

## Decision

### Mobile-first

- **Base styles target narrow viewports** (≤640px). Larger breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280) only *enhance* the mobile design.
- **Container max-width: 720px** for content. Centred on larger screens. This is a legibility decision, not a layout decision.
- **No horizontal scroll** on any viewport between 320px and 2560px wide.

### Touch targets

- **Minimum 44×44px** on every interactive element: buttons, list rows, nav items, checkboxes, switches, pagination controls.
- **Inline links inside paragraphs** are the only exception — they stay default size. Anything that's a primary action gets the 44×44 floor.
- **List rows** (e.g. a Request in the Requests list) are the entire tap target, not just the title text.

### Motion

- All Motion variants honour `prefers-reduced-motion: reduce`. `useReducedMotion()` short-circuits to no-op at the variant level — not at the call site.
- Touch-action: `manipulation` on buttons to prevent 300ms double-tap delay.

### Focus

- Visible focus indicator required on every interactive element.
- **Never `outline: none` without replacement.** A 2px amber focus ring is the default.
- Focus order must follow visual / DOM order.

### Live regions + screen readers

- Search results announce "N results found" via `aria-live="polite"`.
- Status pills carry `aria-label="Status: pending"` (etc.) — the colour and dot are decoration, not the signal.
- Loading spinners carry `aria-label="Loading"`; decorative SVGs are `aria-hidden`.

### Keyboard

- Every interactive element reachable via Tab.
- Enter / Space activate buttons and switches.
- Escape closes any overlay (action sheets, modals).

## Consequences

- The minimum size of a button in code is `md` (44px). Smaller `sm` (36px) variants exist for dense contexts but cannot be used for primary actions.
- New components without focus styles, `aria-*` attributes, or `prefers-reduced-motion` handling are blocked in review.
- The mobile-first rule means every new layout must be checked at 375×667 before approval. Larger-viewport polish is a separate step.
- The `aria-live="polite"` rule means search results must announce count changes — performance-wise, debounce announcements to avoid chatter.
- The "no `outline: none`" rule blocks utility resets that strip focus. Tailwind's `focus:outline-none` is forbidden unless paired with a custom focus-visible style.

## Alternatives considered

- **Desktop-first responsive design.** Rejected: the user base skews mobile; mobile is the design target, not the fallback.
- **Touch target minimum 32×32px.** Rejected: too small for comfortable use. 44×44 is the WCAG-aligned Apple HIG / Material standard.
- **`prefers-reduced-motion` handled at the call site** (e.g. wrap each Motion component). Rejected: drifts. The variant-level short-circuit is the only place it's implemented, and tests assert it there.
- **Skip keyboard support for power-user-only features.** Rejected: keyboard support is non-negotiable. The cost of `tabindex` and key handlers is trivial.
