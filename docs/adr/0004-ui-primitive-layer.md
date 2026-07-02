# ADR-0004: UI Primitive Layer

## Status

Accepted (2026-07-02). Implementation pending — see execution spec at `docs/superpowers/specs/2026-07-02-ui-overhaul-design.md` for the rollout plan.

## Context

The current client has ad-hoc component patterns: bespoke button styles per page, a `.spinner` class, scattered card markup, no shared primitives. Visual consistency is a manual enforcement problem, not a structural one. Tests can't catch a missing focus ring because there's no Button primitive to test against.

We need a primitive layer that:
1. Is the canonical source of UI structure (not just styles).
2. Carries the accessibility contract from ADR-0003.
3. Keeps the dependency surface small.
4. Allows new pages to be built from primitives without copy-paste.

## Decision

### Directory layout

- `src/components/ui/` — primitive components: `Button`, `Input`, `Pill`, `Spinner`, `Surface`, `Switch`. These are the only components that may apply visual styles directly.
- `src/components/motion/` — Motion variants and motion-specific wrappers (`PageTransition`, `StaggerList`, shared variants). Motion logic lives here, not in pages.
- `src/lib/cn.ts` — single `cn()` helper wrapping `clsx` + `tailwind-merge`. The only sanctioned way to compose Tailwind classes.
- `src/lib/motion.ts` — `useReducedMotion` re-export + token hook.

### Variants via CVA

- `class-variance-authority` (already a dep) is the variant system. No bespoke prop-driven style logic.
- Each primitive exports a `*Variants` const for tests to import and assert on.

### Radix UI, scoped

- Radix UI primitives are used **only where they solve an a11y problem we can't easily solve ourselves**: Tooltip, Popover, Switch, Dialog, ActionSheet.
- We do **not** import Radix for layout, styling, or components where the native element is fine (Button, Input, etc.).
- Radix is a dependency of `src/components/ui/*` only. Pages never import Radix directly.

### Motion

- Use the **`motion`** package (the new name of Framer Motion). Not the legacy `framer-motion` import.
- Variants read from `--motion-duration-*` and `--motion-ease-*` CSS custom properties (defined in `src/app/globals.css`).
- Variants are the only place `prefers-reduced-motion` is honoured. Callers don't check.

### Tokens

- All colours, radii, shadows, and motion durations live as CSS custom properties in `src/app/globals.css` under Tailwind v4's `@theme` block.
- Components read tokens via Tailwind utility classes generated from `@theme`. No raw hex values in component code.

### Page composition

- Pages compose primitives. Pages do not define their own Button, Input, or Card components.
- Page-level layout (e.g. a two-thirds hero on `/`) is a page concern. The structure is composed in `src/app/page.tsx` and similar; the *visuals* flow through primitives.

## Consequences

- The Button primitive is the only place a button visual lives. Replacing it (e.g. swapping CVA for something else) is one-file work.
- Motion dependencies are isolated: removing the `motion` package would touch `src/components/motion/*` and nothing else.
- Test surface is unified: every primitive has variant + state + a11y tests in `__tests__/`. A regression in a primitive is caught at that file, not in every page.
- Adding a new primitive (e.g. `Tabs`) is a deliberate act — it requires a new file in `src/components/ui/` with full a11y coverage. It cannot be ad-hoc in a page.
- The Radix dependency boundary is small. We can audit it for bundle size, security, and a11y in one place.
- The token system is the contract between design and code. Changing a token value is a one-file change; the change is visible across the app immediately.

## Alternatives considered

- **Headless UI / React Aria instead of Radix.** Both are good; Radix is already a dep, has a stable Switch/Dialog/Tooltip story, and ships with sane styles-by-default. Switching would require a successor ADR.
- **Tailwind only, no primitives.** Rejected: drifts. The "every page defines its own button" path is exactly what produced the current UI.
- **CSS Modules per component.** Rejected: tokens are CSS custom properties + Tailwind utilities. Adding CSS Modules would split the styling system.
- **Motion baked into every component.** Rejected: motion is a layer, not a default. Static components stay static; opting in to motion is explicit.
- **Reuse existing shadcn/ui template wholesale.** Rejected: a port of shadcn would import Radix + CVA + motion but wouldn't carry the Warm Cinema token set. Building our own primitives with the right tokens is cheaper than re-skinning shadcn.
