# MovieDB UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing ad-hoc Tailwind UI with a deliberate "Warm Cinema" design system: mobile-first, accessible, Motion-animated.

**Architecture:** Token-based CSS (Tailwind v4 `@theme`) + CVA component primitives + Motion variants. New `src/components/ui/` for primitives, new `src/components/motion/` for shared motion. Server components stay server; client components use Motion only where needed. Phased rollout, each phase ships and validates independently.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Tailwind CSS v4, motion (Framer Motion successor), class-variance-authority, clsx, tailwind-merge, Radix UI Switch, Inter + Instrument Serif via `next/font`, Jest 30 + Testing Library, devcontainer.

**Validation:** Every phase ends with `devcontainer exec 'npm run check'` (lint, test, typecheck, build). Must pass before next phase.

**Spec:** `docs/superpowers/specs/2026-07-02-ui-overhaul-design.md`

---

## File Structure (planned)

### New
- `src/components/ui/Button.tsx` — CVA button (variants, sizes, loading, icon)
- `src/components/ui/Input.tsx` — text input with label + focus ring
- `src/components/ui/Pill.tsx` — status pill with dot + label
- `src/components/ui/Surface.tsx` — elevated card surface
- `src/components/ui/Spinner.tsx` — accessible spinner
- `src/components/ui/Switch.tsx` — Radix Switch styled
- `src/components/motion/variants.ts` — shared Motion variants
- `src/components/motion/PageTransition.tsx` — route transition wrapper
- `src/components/motion/StaggerList.tsx` — staggered list wrapper
- `src/lib/cn.ts` — clsx + tailwind-merge helper
- `src/lib/motion.ts` — useReducedMotion re-export

### Modified
- `src/app/globals.css` — Warm Cinema tokens
- `src/app/layout.tsx` — new header, fonts, PageTransition
- `src/app/page.tsx` — two-thirds hero restructure
- `src/app/requests/page.tsx` — horizontal row list, Switch
- `src/app/components/Navigation.tsx` — icon-first
- `src/app/components/Pagination.tsx` — new Button
- `src/components/RequestCard.tsx` — primitives
- `src/components/RequestForm.tsx` — primitives
- `src/components/RequestList.tsx` — primitives + stagger
- `src/components/RequestListItem.tsx` — logic-only
- `src/components/ShowFulfilledCheckbox.tsx` — use Switch
- `src/components/JellyfinBadge.tsx` → replaced by Pill
- `package.json` — add `motion` dep

### Removed (CSS classes)
- `.btn-primary`, `.btn-secondary`, `.btn-md`, `.card`, `.card-row`, `.alert-error`, `.alert-warning`, `.alert-request`, `.badge-success` (replaced by primitives; not deleted in Phase 1, only after primitives wired in)

### Unchanged
- All `/api/**` routes
- All server actions
- Prisma schema
- Helm chart
- Devcontainer

---

# Phase 1 — Foundation

## Task 1.1: Add Motion dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the dep**

```bash
devcontainer exec 'npm install motion@latest'
```

- [ ] **Step 2: Verify install**

Run: `devcontainer exec 'node -e "console.log(require(\"motion/package.json\").version)"'`
Expected: prints a version string (e.g. `12.x.x`).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add motion dependency"
```

---

## Task 1.2: Create `cn()` helper

**Files:**
- Create: `src/lib/cn.ts`
- Test: `src/lib/__tests__/cn.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/cn.test.ts`:

```ts
import { cn } from '@/lib/cn';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('drops falsy values', () => {
    expect(cn('foo', false, null, undefined, '', 'bar')).toBe('foo bar');
  });

  it('deduplicates tailwind conflicts (later wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devcontainer exec 'npm test -- --testPathPattern=cn.test'`
Expected: FAIL — `Cannot find module '@/lib/cn'`.

- [ ] **Step 3: Implement `cn`**

Create `src/lib/cn.ts`:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devcontainer exec 'npm test -- --testPathPattern=cn.test'`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cn.ts src/lib/__tests__/cn.test.ts
git commit -m "feat(ui): add cn() class merge helper"
```

---

## Task 1.3: Replace color tokens in `globals.css`

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the `@layer base` block**

Replace the existing `:root` and `.dark` blocks in `src/app/globals.css` with a single dark-only token set:

```css
@layer base {
  :root {
    /* Surfaces */
    --background:       24 10% 5%;
    --surface:          24 9% 11%;
    --surface-elevated: 24 8% 16%;
    --border:           24 6% 26%;
    --border-subtle:    24 6% 18%;

    /* Foreground */
    --foreground:       60 9% 98%;
    --muted:            24 6% 20%;
    --muted-foreground: 24 5% 64%;

    /* Accent (amber) */
    --accent:           38 92% 50%;
    --accent-hover:     38 95% 60%;
    --accent-fg:        24 10% 9%;

    /* Status */
    --status-pending-text:    38 92% 60%;
    --status-pending-bg:      38 70% 16%;
    --status-downloading-text: 217 91% 70%;
    --status-downloading-bg:   217 60% 18%;
    --status-fulfilled-text:  142 71% 60%;
    --status-fulfilled-bg:    142 50% 14%;
    --status-canceled-text:   0 84% 70%;
    --status-canceled-bg:     0 60% 18%;

    /* Motion */
    --motion-duration-instant: 100ms;
    --motion-duration-fast:    150ms;
    --motion-duration-base:    250ms;
    --motion-duration-slow:    400ms;
  }
}
```

- [ ] **Step 2: Update the `@theme` block to expose motion durations**

In the same file, extend the `@theme` block to include motion tokens (Tailwind v4 reads them as `--color-*` and `--*` utilities):

```css
@theme {
  --color-background: hsl(var(--background));
  --color-surface: hsl(var(--surface));
  --color-surface-elevated: hsl(var(--surface-elevated));
  --color-foreground: hsl(var(--foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-border: hsl(var(--border));
  --color-border-subtle: hsl(var(--border-subtle));
  --color-accent: hsl(var(--accent));
  --color-accent-hover: hsl(var(--accent-hover));
  --color-accent-fg: hsl(var(--accent-fg));
  --color-status-pending-text: hsl(var(--status-pending-text));
  --color-status-pending-bg: hsl(var(--status-pending-bg));
  --color-status-downloading-text: hsl(var(--status-downloading-text));
  --color-status-downloading-bg: hsl(var(--status-downloading-bg));
  --color-status-fulfilled-text: hsl(var(--status-fulfilled-text));
  --color-status-fulfilled-bg: hsl(var(--status-fulfilled-bg));
  --color-status-canceled-text: hsl(var(--status-canceled-text));
  --color-status-canceled-bg: hsl(var(--status-canceled-bg));
}
```

- [ ] **Step 3: Verify build still passes**

Run: `devcontainer exec 'npm run check'`
Expected: PASS (existing components still resolve their CSS classes via the renamed token names; `--background` and `--foreground` are unchanged in name, so `bg-background text-foreground` still works).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): replace color tokens with Warm Cinema palette"
```

---

## Task 1.4: Create Spinner primitive

**Files:**
- Create: `src/components/ui/Spinner.tsx`
- Test: `src/components/ui/__tests__/Spinner.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/Spinner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Spinner } from '@/components/ui/Spinner';

describe('Spinner', () => {
  it('renders with default label', () => {
    render(<Spinner />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('accepts a custom label', () => {
    render(<Spinner label="Loading requests" />);
    expect(screen.getByLabelText('Loading requests')).toBeInTheDocument();
  });

  it('applies size class', () => {
    const { container } = render(<Spinner size="lg" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('h-6', 'w-6');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devcontainer exec 'npm test -- --testPathPattern=Spinner.test'`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Spinner**

Create `src/components/ui/Spinner.tsx`:

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const spinnerVariants = cva('animate-spin', {
  variants: {
    size: {
      sm: 'h-3 w-3',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    },
  },
  defaultVariants: { size: 'md' },
});

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  label?: string;
  className?: string;
}

export function Spinner({ size, label = 'Loading', className }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <svg
        aria-hidden="true"
        className={cn('animate-spin', spinnerVariants({ size }))}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devcontainer exec 'npm test -- --testPathPattern=Spinner.test'`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Spinner.tsx src/components/ui/__tests__/Spinner.test.tsx
git commit -m "feat(ui): add Spinner primitive"
```

---

## Task 1.5: Create Button primitive

**Files:**
- Create: `src/components/ui/Button.tsx`
- Test: `src/components/ui/__tests__/Button.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/Button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-accent');
  });

  it('applies secondary variant', () => {
    render(<Button variant="secondary">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-surface-elevated');
  });

  it('sets minimum touch target height (md = 44px)', () => {
    render(<Button size="md">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-11');
  });

  it('shows spinner and sets aria-busy when loading', () => {
    render(<Button loading>Go</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('is disabled when loading', () => {
    render(<Button loading>Go</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when disabled prop set', () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards ref', () => {
    const ref = { current: null } as React.RefObject<HTMLButtonElement | null>;
    render(<Button ref={ref}>Go</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devcontainer exec 'npm test -- --testPathPattern=Button.test'`
Expected: FAIL.

- [ ] **Step 3: Implement Button**

Create `src/components/ui/Button.tsx`:

```tsx
'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] motion-safe:transition-transform touch-manipulation',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
        secondary: 'bg-surface-elevated text-foreground hover:bg-surface-elevated/80',
        ghost: 'bg-transparent text-foreground hover:bg-surface-elevated',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        success: 'bg-emerald-600 text-white hover:bg-emerald-700',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-sm',
        lg: 'h-13 px-5 text-base',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && <Spinner size="sm" className="text-current" />}
      {children}
    </button>
  );
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devcontainer exec 'npm test -- --testPathPattern=Button.test'`
Expected: PASS (9/9).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/__tests__/Button.test.tsx
git commit -m "feat(ui): add Button primitive with CVA variants"
```

---

## Task 1.6: Create Input primitive

**Files:**
- Create: `src/components/ui/Input.tsx`
- Test: `src/components/ui/__tests__/Input.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/Input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('renders with label and associates htmlFor', () => {
    render(<Input label="Search" id="q" />);
    const input = screen.getByLabelText('Search');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('id', 'q');
  });

  it('renders placeholder', () => {
    render(<Input label="Search" placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
  });

  it('calls onChange', async () => {
    const onChange = jest.fn();
    render(<Input label="X" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('X'), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('is disabled when disabled prop set', () => {
    render(<Input label="X" disabled />);
    expect(screen.getByLabelText('X')).toBeDisabled();
  });

  it('applies search variant height (52px)', () => {
    render(<Input label="X" variant="search" />);
    expect(screen.getByLabelText('X')).toHaveClass('h-13');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devcontainer exec 'npm test -- --testPathPattern=Input.test'`
Expected: FAIL.

- [ ] **Step 3: Implement Input**

Create `src/components/ui/Input.tsx`:

```tsx
import { forwardRef, type InputHTMLAttributes, useId } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const inputVariants = cva(
  'w-full rounded-xl border border-border bg-surface-elevated px-4 text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 touch-manipulation',
  {
    variants: {
      variant: {
        default: 'h-11 text-sm',
        search: 'h-13 text-base px-5',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, variant, label, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(inputVariants({ variant }), className)}
        {...props}
      />
    </div>
  );
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devcontainer exec 'npm test -- --testPathPattern=Input.test'`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Input.tsx src/components/ui/__tests__/Input.test.tsx
git commit -m "feat(ui): add Input primitive with label and search variant"
```

---

## Task 1.7: Create Surface primitive

**Files:**
- Create: `src/components/ui/Surface.tsx`
- Test: `src/components/ui/__tests__/Surface.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/Surface.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Surface } from '@/components/ui/Surface';

describe('Surface', () => {
  it('renders children', () => {
    render(<Surface>Hello</Surface>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies base by default', () => {
    const { container } = render(<Surface>x</Surface>);
    expect(container.firstChild).toHaveClass('bg-background');
  });

  it('applies raised variant with shadow', () => {
    const { container } = render(<Surface elevation="raised">x</Surface>);
    expect(container.firstChild).toHaveClass('bg-surface-elevated', 'shadow-lg', 'shadow-black/30');
  });

  it('renders as a different element when as prop set', () => {
    render(<Surface as="article">x</Surface>);
    expect(screen.getByText('x').tagName).toBe('ARTICLE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devcontainer exec 'npm test -- --testPathPattern=Surface.test'`
Expected: FAIL.

- [ ] **Step 3: Implement Surface**

Create `src/components/ui/Surface.tsx`:

```tsx
import { type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const surfaceVariants = cva('rounded-2xl border', {
  variants: {
    elevation: {
      base: 'bg-background border-transparent',
      raised: 'bg-surface-elevated border-border-subtle shadow-lg shadow-black/30',
      overlay: 'bg-surface-elevated border-border shadow-2xl shadow-black/50',
    },
  },
  defaultVariants: { elevation: 'base' },
});

interface SurfaceProps
  extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof surfaceVariants> {
  as?: ElementType;
  children?: ReactNode;
}

export function Surface({ className, elevation, as, children, ...props }: SurfaceProps) {
  const Tag = (as ?? 'div') as ElementType;
  return (
    <Tag className={cn(surfaceVariants({ elevation }), className)} {...props}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devcontainer exec 'npm test -- --testPathPattern=Surface.test'`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Surface.tsx src/components/ui/__tests__/Surface.test.tsx
git commit -m "feat(ui): add Surface primitive with elevation levels"
```

---

## Task 1.8: Create Pill primitive

**Files:**
- Create: `src/components/ui/Pill.tsx`
- Test: `src/components/ui/__tests__/Pill.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/Pill.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Pill } from '@/components/ui/Pill';

describe('Pill', () => {
  it('renders label', () => {
    render(<Pill variant="pending">Pending</Pill>);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('applies pending variant colors', () => {
    render(<Pill variant="pending">x</Pill>);
    expect(screen.getByText('x').parentElement).toHaveClass('bg-(--color-status-pending-bg)');
  });

  it('renders with dot', () => {
    const { container } = render(<Pill variant="fulfilled">x</Pill>);
    expect(container.querySelector('span > span')).toBeInTheDocument();
  });

  it('supports custom label via prop', () => {
    render(<Pill variant="available" label="On Jellyfin" />);
    expect(screen.getByText('On Jellyfin')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devcontainer exec 'npm test -- --testPathPattern=Pill.test'`
Expected: FAIL.

- [ ] **Step 3: Implement Pill**

Create `src/components/ui/Pill.tsx`:

```tsx
import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const pillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        pending: 'bg-(--color-status-pending-bg) text-(--color-status-pending-text) border-(--color-status-pending-text)/20',
        downloading: 'bg-(--color-status-downloading-bg) text-(--color-status-downloading-text) border-(--color-status-downloading-text)/20',
        fulfilled: 'bg-(--color-status-fulfilled-bg) text-(--color-status-fulfilled-text) border-(--color-status-fulfilled-text)/20',
        canceled: 'bg-(--color-status-canceled-bg) text-(--color-status-canceled-text) border-(--color-status-canceled-text)/20',
        available: 'bg-(--color-status-fulfilled-bg) text-(--color-status-fulfilled-text) border-(--color-status-fulfilled-text)/20',
      },
    },
    defaultVariants: { variant: 'pending' },
  }
);

const DOT_COLORS: Record<NonNullable<VariantProps<typeof pillVariants>['variant']>, string> = {
  pending: 'bg-(--color-status-pending-text)',
  downloading: 'bg-(--color-status-downloading-text)',
  fulfilled: 'bg-(--color-status-fulfilled-text)',
  canceled: 'bg-(--color-status-canceled-text)',
  available: 'bg-(--color-status-fulfilled-text)',
};

interface PillProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {
  label: string;
}

export function Pill({ variant, label, className, ...props }: PillProps) {
  return (
    <span
      className={cn(pillVariants({ variant }), className)}
      role="status"
      aria-label={`Status: ${label}`}
      {...props}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', DOT_COLORS[variant ?? 'pending'])} />
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devcontainer exec 'npm test -- --testPathPattern=Pill.test'`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Pill.tsx src/components/ui/__tests__/Pill.test.tsx
git commit -m "feat(ui): add Pill status primitive"
```

---

## Task 1.9: Create Switch primitive (Radix)

**Files:**
- Create: `src/components/ui/Switch.tsx`
- Test: `src/components/ui/__tests__/Switch.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/Switch.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '@/components/ui/Switch';

describe('Switch', () => {
  it('renders with label', () => {
    render(<Switch label="Show fulfilled" />);
    expect(screen.getByRole('switch', { name: 'Show fulfilled' })).toBeInTheDocument();
  });

  it('toggles checked state on click', async () => {
    render(<Switch label="x" />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onCheckedChange', async () => {
    const onChange = jest.fn();
    render(<Switch label="x" onCheckedChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devcontainer exec 'npm test -- --testPathPattern=Switch.test'`
Expected: FAIL.

- [ ] **Step 3: Implement Switch**

Create `src/components/ui/Switch.tsx`:

```tsx
'use client';

import * as RadixSwitch from '@radix-ui/react-switch';
import { forwardRef, type ComponentRef } from 'react';
import { cn } from '@/lib/cn';

interface SwitchProps {
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const Switch = forwardRef<ComponentRef<typeof RadixSwitch.Root>, SwitchProps>(function Switch(
  { label, checked, defaultChecked, onCheckedChange, disabled, id, className },
  ref
) {
  return (
    <label className={cn('inline-flex items-center gap-3 cursor-pointer touch-manipulation', className)}>
      <RadixSwitch.Root
        ref={ref}
        id={id}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'group relative h-7 w-12 rounded-full border border-border-subtle bg-surface-elevated transition-colors',
          'data-[state=checked]:bg-accent data-[state=checked]:border-accent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block h-5 w-5 translate-x-0.5 rounded-full bg-foreground transition-transform',
            'data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-accent-fg'
          )}
        />
      </RadixSwitch.Root>
      {label && <span className="text-sm text-foreground select-none">{label}</span>}
    </label>
  );
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devcontainer exec 'npm test -- --testPathPattern=Switch.test'`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Switch.tsx src/components/ui/__tests__/Switch.test.tsx
git commit -m "feat(ui): add Switch primitive wrapping Radix"
```

---

## Task 1.10: Create motion variants module

**Files:**
- Create: `src/components/motion/variants.ts`
- Test: `src/components/motion/__tests__/variants.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/motion/__tests__/variants.test.ts`:

```ts
import { fadeUp, stagger, scaleTap, getVariants } from '@/components/motion/variants';

describe('motion variants', () => {
  it('fadeUp defines hidden and visible', () => {
    expect(fadeUp).toHaveProperty('hidden');
    expect(fadeUp).toHaveProperty('visible');
  });

  it('stagger defines visible transition', () => {
    expect(stagger.visible.transition).toBeDefined();
    expect((stagger.visible.transition as { staggerChildren: number }).staggerChildren).toBeGreaterThan(0);
  });

  it('scaleTap provides whileTap prop', () => {
    expect(scaleTap.whileTap).toEqual({ scale: 0.97 });
  });

  it('getVariants returns no-op variants when reduced motion is true', () => {
    const reduced = getVariants({ reducedMotion: true });
    expect(reduced.fadeUp.hidden).toEqual({});
    expect(reduced.fadeUp.visible).toEqual({});
  });

  it('getVariants returns standard variants when reduced motion is false', () => {
    const full = getVariants({ reducedMotion: false });
    expect(full.fadeUp.hidden).toEqual({ opacity: 0, y: 12 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devcontainer exec 'npm test -- --testPathPattern=variants.test'`
Expected: FAIL.

- [ ] **Step 3: Implement variants**

Create `src/components/motion/variants.ts`:

```ts
import type { Variants } from 'motion/react';

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  },
};

export const stagger: Variants = {
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

export const scaleTap = {
  whileTap: { scale: 0.97 },
  transition: { duration: 0.1 },
} as const;

const noOp: Variants = {
  hidden: {},
  visible: {},
};

interface GetVariantsOptions {
  reducedMotion: boolean;
}

export function getVariants({ reducedMotion }: GetVariantsOptions) {
  if (reducedMotion) {
    return { fadeUp: noOp, stagger: { visible: { transition: { staggerChildren: 0 } } } };
  }
  return { fadeUp, stagger };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devcontainer exec 'npm test -- --testPathPattern=variants.test'`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/components/motion/variants.ts src/components/motion/__tests__/variants.test.ts
git commit -m "feat(motion): add shared variants with reduced-motion support"
```

---

## Task 1.11: Create useReducedMotion re-export and PageTransition

**Files:**
- Create: `src/lib/motion.ts`
- Create: `src/components/motion/PageTransition.tsx`
- Test: `src/components/motion/__tests__/PageTransition.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/motion/__tests__/PageTransition.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { PageTransition } from '@/components/motion/PageTransition';

describe('PageTransition', () => {
  it('renders children', () => {
    render(<PageTransition>Hello</PageTransition>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devcontainer exec 'npm test -- --testPathPattern=PageTransition.test'`
Expected: FAIL.

- [ ] **Step 3: Implement `useReducedMotion` re-export and `PageTransition`**

Create `src/lib/motion.ts`:

```ts
export { useReducedMotion } from 'motion/react';
```

Create `src/components/motion/PageTransition.tsx`:

```tsx
'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useReducedMotion } from '@/lib/motion';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devcontainer exec 'npm test -- --testPathPattern=PageTransition.test'`
Expected: PASS (1/1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/motion.ts src/components/motion/PageTransition.tsx src/components/motion/__tests__/PageTransition.test.tsx
git commit -m "feat(motion): add PageTransition wrapper with reduced-motion gate"
```

---

## Task 1.12: Create StaggerList helper

**Files:**
- Create: `src/components/motion/StaggerList.tsx`
- Test: `src/components/motion/__tests__/StaggerList.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/motion/__tests__/StaggerList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { StaggerList } from '@/components/motion/StaggerList';

describe('StaggerList', () => {
  it('renders list of items', () => {
    render(
      <StaggerList items={['a', 'b', 'c']} renderItem={(item) => <span key={item}>{item}</span>} />
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
  });

  it('applies role list', () => {
    const { container } = render(
      <StaggerList items={[1]} renderItem={(i) => <span key={i}>x</span>} />
    );
    expect(container.firstChild).toHaveAttribute('role', 'list');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devcontainer exec 'npm test -- --testPathPattern=StaggerList.test'`
Expected: FAIL.

- [ ] **Step 3: Implement StaggerList**

Create `src/components/motion/StaggerList.tsx`:

```tsx
'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useReducedMotion } from '@/lib/motion';
import { fadeUp, stagger } from './variants';

interface StaggerListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
}

export function StaggerList<T>({ items, renderItem, className }: StaggerListProps<T>) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      role="list"
      variants={stagger}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {items.map((item, i) => (
        <motion.div key={i} variants={reduced ? undefined : fadeUp}>
          {renderItem(item, i)}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devcontainer exec 'npm test -- --testPathPattern=StaggerList.test'`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/components/motion/StaggerList.tsx src/components/motion/__tests__/StaggerList.test.tsx
git commit -m "feat(motion): add StaggerList wrapper"
```

---

## Task 1.13: Validate Phase 1

- [ ] **Step 1: Run full check**

Run: `devcontainer exec 'npm run check'`
Expected: PASS — lint, all tests, typecheck, build all succeed. No warnings.

If any check fails, fix and re-run before proceeding to Phase 2.

- [ ] **Step 2: Tag the milestone**

```bash
git tag phase-1-foundation
```

---

# Phase 2 — Header + Layout

## Task 2.1: Add fonts via `next/font`

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add font imports**

Edit `src/app/layout.tsx`. Replace the existing imports at the top with:

```tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { Navigation } from './components/Navigation';
import { PageTransition } from '@/components/motion/PageTransition';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
```

- [ ] **Step 2: Apply font variables to `<html>` and add `themeColor`**

In the same file, modify the `RootLayout` component:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body className="font-sans bg-background text-foreground antialiased">
        <Header />
        <PageTransition>
          <main>{children}</main>
        </PageTransition>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Add `Header` as a local component**

Add at the bottom of `src/app/layout.tsx` (still inside the same file, before the export):

```tsx
function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold text-foreground hover:opacity-80 transition-opacity"
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
          Jellyfin
        </Link>
        <Navigation />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Update metadata theme color**

Modify the `viewport` constant in the same file:

```tsx
export const viewport: Viewport = {
  themeColor: '#1c1917',
};
```

- [ ] **Step 5: Verify build**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(ui): add Inter + Instrument Serif fonts, sticky header, page transition"
```

---

## Task 2.2: Refactor Navigation for icon-first mobile

**Files:**
- Modify: `src/app/components/Navigation.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/app/components/Navigation.tsx` with:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
}

const ITEMS: NavItem[] = [
  { href: '/', label: 'Search', icon: '🔍', match: (p) => p === '/' },
  { href: '/requests', label: 'Requests', icon: '📋', match: (p) => p.startsWith('/requests') },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="ml-auto flex items-center gap-1">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'relative inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              active
                ? 'text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated',
            ].join(' ')}
          >
            <span aria-hidden="true" className="text-base leading-none">{item.icon}</span>
            <span className="hidden sm:inline">{item.label}</span>
            {active && <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/Navigation.tsx
git commit -m "feat(ui): icon-first navigation with active indicator"
```

---

## Task 2.3: Validate Phase 2

- [ ] **Step 1: Run full check**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 2: Visual smoke test**

Run: `devcontainer exec 'npm run dev'`

In browser:
- Visit `/` — sticky header with amber dot + "Jellyfin" + icon nav (Search/Requests). Page fades in on load.
- Visit `/requests` — same header. Navigation icons visible, labels appear at sm+ width.
- Resize to mobile (375px wide) — header collapses to icons only.
- Toggle `prefers-reduced-motion` in dev tools — no fade-in.

- [ ] **Step 3: Tag the milestone**

```bash
git tag phase-2-header-layout
```

---

# Phase 3 — Home Page (Search)

## Task 3.1: Refactor home page hero and search panel

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the imports section**

In `src/app/page.tsx`, replace the import block (lines 1–9) with:

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { createRequest, createTvShowRequests } from '@/app/actions/request-actions';
import { RequestForm } from '@/components/RequestForm';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Surface } from '@/components/ui/Surface';
import { StaggerList } from '@/components/motion/StaggerList';
import { useReducedMotion } from '@/lib/motion';
import { fadeUp } from '@/components/motion/variants';
import { GENRE_MAP } from '@/lib/genres';
import { logger } from '@/lib/logger';
```

(Keep the existing type and helper definitions below — `TMDBMovieResult`, etc.)

- [ ] **Step 2: Replace the JSX return value**

Replace the entire `return (...)` block of `ImportPage` (the existing `<main className="page-container">...</main>`) with:

```tsx
const reduced = useReducedMotion();

return (
  <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
    <motion.section
      variants={reduced ? undefined : fadeUp}
      initial="hidden"
      animate="visible"
      className="mb-8 text-center sm:mb-12"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">● Live</p>
      <h1 className="font-display text-4xl italic leading-[1.05] text-foreground sm:text-5xl">
        What&rsquo;s on tonight?
      </h1>
      <p className="mt-3 text-sm text-muted-foreground sm:text-base">
        Search your library or request a new title
      </p>
    </motion.section>

    <Surface elevation="raised" className="p-4 sm:p-6">
      <SearchTypeToggle value={searchType} onChange={setSearchType} />

      <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Input
          variant="search"
          label={`Search ${searchType === 'movie' ? 'movies' : 'TV shows'}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchType === 'movie' ? 'Try "Dune Part Two"' : 'Try "The Bear"'}
          className="flex-1"
        />
        <Button type="submit" size="lg" loading={loading} className="sm:w-auto">
          {loading ? 'Searching' : 'Search'}
          {loading && <Spinner size="sm" />}
        </Button>
      </form>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {jellyfinError && (
        <div role="alert" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <strong>Jellyfin:</strong> {jellyfinError}
        </div>
      )}

      {currentResults.length > 0 && (
        <div className="mt-6 space-y-3">
          <StaggerList
            items={currentResults}
            className="space-y-3"
            renderItem={(item) => (
              searchType === 'movie'
                ? <MovieResultCard
                    key={(item as TMDBMovieResult).id}
                    movie={item as TMDBMovieResult}
                    onJellyfin={jellyfinResults[(item as TMDBMovieResult).id] || false}
                    isRequesting={requesting === String((item as TMDBMovieResult).id)}
                    onRequest={() => setRequesting(String((item as TMDBMovieResult).id))}
                    onSubmit={(name) => handleMovieRequest(item as TMDBMovieResult, name)}
                    onCancel={() => setRequesting(null)}
                  />
                : <TvResultCard
                    key={(item as TMDBSeriesResult).id}
                    show={item as TMDBSeriesResult}
                    availableSeasons={jellyfinSeasons[(item as TMDBSeriesResult).id] || []}
                    allSeasons={tmdbSeasons[(item as TMDBSeriesResult).id] || []}
                    requesting={requesting}
                    onRequestSeason={(n) => setRequesting(`${(item as TMDBSeriesResult).id}-${n}`)}
                    onRequestAll={() => setRequesting(`${(item as TMDBSeriesResult).id}-all`)}
                    onSubmitSeason={(n, name) => handleSeasonRequest(item as TMDBSeriesResult, n, name)}
                    onSubmitAll={(name) => handleRequestAllSeasons(item as TMDBSeriesResult, name)}
                    onCancel={() => setRequesting(null)}
                  />
            )}
          />
        </div>
      )}
    </Surface>
  </main>
);
```

- [ ] **Step 3: Add `SearchTypeToggle` and result card components at the bottom of the file**

Append these components to the end of `src/app/page.tsx` (above the `ImportPage` export is fine, or below — order does not matter for module-level declarations):

```tsx
function SearchTypeToggle({ value, onChange }: { value: SearchType; onChange: (v: SearchType) => void }) {
  return (
    <div role="tablist" aria-label="Search type" className="inline-flex rounded-full border border-border-subtle bg-surface p-1">
      {(['movie', 'tv'] as const).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt)}
            className={[
              'h-9 rounded-full px-4 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              active ? 'bg-accent text-accent-fg' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {opt === 'movie' ? 'Movies' : 'TV Shows'}
          </button>
        );
      })}
    </div>
  );
}

function MovieResultCard({
  movie, onJellyfin, isRequesting, onRequest, onSubmit, onCancel,
}: {
  movie: TMDBMovieResult;
  onJellyfin: boolean;
  isRequesting: boolean;
  onRequest: () => void;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
    : null;

  return (
    <Surface elevation="raised" className="flex gap-3 p-3 sm:gap-4">
      {posterUrl ? (
        <a href={`https://www.themoviedb.org/movie/${movie.id}`} target="_blank" rel="noopener noreferrer" className="block w-14 flex-shrink-0 sm:w-20">
          <Image src={posterUrl} alt={movie.title} width={80} height={120} className="h-auto w-full rounded-lg object-cover" />
        </a>
      ) : (
        <div className="h-[80px] w-14 flex-shrink-0 rounded-lg bg-surface sm:h-[120px] sm:w-20" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <a
              href={`https://www.themoviedb.org/movie/${movie.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-base font-semibold text-foreground hover:text-accent"
            >
              {movie.title}
            </a>
            <p className="text-xs text-muted-foreground">
              {getYear(movie.release_date)}
              {movie.genre_ids?.length ? ` · ${getGenreNamesDisplay(movie.genre_ids)}` : ''}
            </p>
          </div>
          {onJellyfin && <Pill variant="available" label="On Jellyfin" />}
        </div>
        {movie.overview && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{movie.overview}</p>
        )}
        <div className="mt-2">
          {!onJellyfin && !isRequesting && (
            <Button size="sm" onClick={onRequest}>Request</Button>
          )}
          {isRequesting && (
            <RequestForm isVisible onSubmit={onSubmit} onCancel={onCancel} />
          )}
        </div>
      </div>
    </Surface>
  );
}

function TvResultCard({
  show, availableSeasons, allSeasons, requesting, onRequestSeason, onRequestAll, onSubmitSeason, onSubmitAll, onCancel,
}: {
  show: TMDBSeriesResult;
  availableSeasons: number[];
  allSeasons: TMDBSeason[];
  requesting: string | null;
  onRequestSeason: (n: number) => void;
  onRequestAll: () => void;
  onSubmitSeason: (n: number, name: string) => Promise<void>;
  onSubmitAll: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const posterUrl = show.poster_path
    ? `https://image.tmdb.org/t/p/w185${show.poster_path}`
    : null;
  const regularSeasons = allSeasons.filter((s) => s.season_number > 0);
  const missing = regularSeasons.filter((s) => !availableSeasons.includes(s.season_number));
  const allDone = missing.length === 0 && regularSeasons.length > 0;

  return (
    <Surface elevation="raised" className="flex gap-3 p-3 sm:gap-4">
      {posterUrl ? (
        <a href={`https://www.themoviedb.org/tv/${show.id}`} target="_blank" rel="noopener noreferrer" className="block w-14 flex-shrink-0 sm:w-20">
          <Image src={posterUrl} alt={show.name} width={80} height={120} className="h-auto w-full rounded-lg object-cover" />
        </a>
      ) : (
        <div className="h-[80px] w-14 flex-shrink-0 rounded-lg bg-surface sm:h-[120px] sm:w-20" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div>
          <a
            href={`https://www.themoviedb.org/tv/${show.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-base font-semibold text-foreground hover:text-accent"
          >
            {show.name}
          </a>
          <p className="text-xs text-muted-foreground">
            {getYear(show.first_air_date)}
            {show.genre_ids?.length ? ` · ${getGenreNamesDisplay(show.genre_ids)}` : ''}
          </p>
        </div>

        {regularSeasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {regularSeasons.map((s) => {
              const available = availableSeasons.includes(s.season_number);
              const key = `${show.id}-${s.season_number}`;
              const isReq = requesting === key;
              return (
                <div key={s.season_number} className="flex items-center gap-1">
                  {available ? (
                    <Pill variant="available" label={`S${s.season_number}`} />
                  ) : isReq ? (
                    <RequestForm
                      isVisible
                      onSubmit={(name) => onSubmitSeason(s.season_number, name)}
                      onCancel={onCancel}
                    />
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => onRequestSeason(s.season_number)}>
                      S{s.season_number}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {missing.length > 0 && (
          <div className="mt-2">
            {requesting === `${show.id}-all` ? (
              <RequestForm isVisible onSubmit={onSubmitAll} onCancel={onCancel} />
            ) : (
              <Button size="sm" onClick={onRequestAll}>
                Request all missing ({missing.length})
              </Button>
            )}
          </div>
        )}

        {allDone && <p className="mt-2 text-xs text-emerald-400">All seasons available or requested</p>}
      </div>
    </Surface>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): restructure home page to two-thirds hero with primitives"
```

---

## Task 3.2: Validate Phase 3

- [ ] **Step 1: Run full check**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 2: Visual smoke test**

Run: `devcontainer exec 'npm run dev'`

In browser at `/`:
- Hero copy shows "What's on tonight?" in italic serif.
- Search panel is elevated, 16px radius.
- Type "Dune" → click Search → results stagger in.
- Click Request on a result → form appears in place of button.
- Pill "On Jellyfin" appears next to items that are on Jellyfin.
- Resize to 375px → all touch targets feel right; type toggle collapses nicely.

- [ ] **Step 3: Tag the milestone**

```bash
git tag phase-3-home
```

---

# Phase 4 — Requests Page

## Task 4.1: Rebuild RequestCard to use primitives

**Files:**
- Modify: `src/components/RequestCard.tsx`
- Modify: `src/components/__tests__/RequestCard.test.tsx` (existing — update if it breaks)

- [ ] **Step 1: Write the failing test for new structure**

If `src/components/__tests__/RequestCard.test.tsx` exists, add a new test at the end of its `describe('RequestCard')` block (or create it if not). Add this test:

```tsx
it('renders poster, title, status pill, and action buttons', () => {
  render(
    <RequestCard
      request={baseRequest}
      onMarkFulfilled={jest.fn()}
      onDownload={jest.fn()}
      onCancel={jest.fn()}
    />
  );
  expect(screen.getByText(baseRequest.title)).toBeInTheDocument();
  expect(screen.getByText(/pending/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
});
```

(If the existing test file uses different fixtures, adapt to whatever `Request` fixture the existing tests use — the assertion pattern above is the requirement.)

- [ ] **Step 2: Run test to verify behavior under existing impl**

Run: `devcontainer exec 'npm test -- --testPathPattern=RequestCard.test'`
Expected: Existing tests pass; new test should pass with the rebuilt component once Step 3 lands.

- [ ] **Step 3: Replace the RequestCard component**

Overwrite `src/components/RequestCard.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getActionsForStatus } from '@/lib/request-fsm';
import { STATUS_CONFIG } from '@/lib/request-theme';
import { getGenreNames } from '@/lib/genres';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { Request } from '@/types/request';

interface RequestCardProps {
  request: Request;
  onMarkFulfilled: () => void | Promise<void>;
  onDownload: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  jellyfinAvailable?: boolean;
  formattedDate?: string;
}

const PILL_VARIANT = {
  pending: 'pending',
  downloading: 'downloading',
  fulfilled: 'fulfilled',
  canceled: 'canceled',
} as const;

const ACTION_VARIANT = {
  download: 'primary',
  fulfill: 'success',
  cancel: 'danger',
} as const;

export default function RequestCard({
  request,
  onMarkFulfilled,
  onDownload,
  onCancel,
  jellyfinAvailable = false,
  formattedDate,
}: RequestCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const statusConfig = STATUS_CONFIG[request.status];
  const actions = getActionsForStatus(request.status);

  const handlerMap: Record<string, () => void | Promise<void>> = {
    fulfill: onMarkFulfilled,
    download: onDownload,
    cancel: onCancel,
  };

  const handleAction = async (handler: () => void | Promise<void>) => {
    setIsLoading(true);
    try { await handler(); } finally { setIsLoading(false); }
  };

  const posterUrl = request.poster_path
    ? `https://image.tmdb.org/t/p/w154${request.poster_path}`
    : null;

  return (
    <Surface elevation="raised" className="flex gap-3 p-3 sm:gap-4 sm:p-4">
      {posterUrl ? (
        <a
          href={`https://www.themoviedb.org/${request.media_type === 'tv' ? 'tv' : 'movie'}/${request.tmdb_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-14 flex-shrink-0 sm:w-20"
        >
          <Image src={posterUrl} alt={request.title} width={80} height={120} className="h-auto w-full rounded-lg object-cover" />
        </a>
      ) : (
        <div className="h-[80px] w-14 flex-shrink-0 rounded-lg bg-surface sm:h-[120px] sm:w-20" />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground">
              {request.title}
              {request.season_number && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">— S{request.season_number}</span>
              )}
              {request.release_date && request.media_type !== 'tv' && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">({request.release_date.split('-')[0]})</span>
              )}
            </h3>
            {request.genre_ids && request.genre_ids.length > 0 && (
              <p className="text-xs text-muted-foreground">{getGenreNames(request.genre_ids).join(', ')}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Pill variant={PILL_VARIANT[request.status]} label={statusConfig.label} />
            {request.media_type === 'tv' && <Pill variant="downloading" label="TV" />}
            {jellyfinAvailable && <Pill variant="available" label="On Jellyfin" />}
          </div>
        </div>

        {request.overview && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{request.overview}</p>
        )}

        <p className="mt-1 text-xs text-muted-foreground">
          Requested by {request.requested_by} · {formattedDate ?? new Date(request.requested_at).toLocaleDateString()}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => {
            const handler = handlerMap[action.action];
            if (!handler) return null;
            return (
              <Button
                key={action.action}
                size="sm"
                variant={ACTION_VARIANT[action.action as keyof typeof ACTION_VARIANT] ?? 'secondary'}
                loading={isLoading}
                onClick={() => handleAction(handler)}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}
```

- [ ] **Step 4: Run RequestCard tests**

Run: `devcontainer exec 'npm test -- --testPathPattern=RequestCard.test'`
Expected: PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/components/RequestCard.tsx src/components/__tests__/RequestCard.test.tsx
git commit -m "feat(ui): rebuild RequestCard with primitives and Pill"
```

---

## Task 4.2: Refactor RequestList to use stagger and horizontal rows

**Files:**
- Modify: `src/components/RequestList.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/RequestList.tsx` with:

```tsx
import { Request } from '@/types/request';
import { StaggerList } from '@/components/motion/StaggerList';
import { RequestListItem } from './RequestListItem';

interface RequestListProps {
  requests: Request[];
  jellyfinAvailability: Record<number, boolean>;
}

export default function RequestList({ requests, jellyfinAvailability }: RequestListProps) {
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface/50 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">No requests yet</p>
        <a href="/" className="mt-2 inline-block text-sm font-medium text-accent hover:text-accent-hover">
          Search to add one →
        </a>
      </div>
    );
  }

  return (
    <StaggerList
      items={requests}
      className="space-y-3"
      renderItem={(request) => (
        <RequestListItem
          key={request.id}
          request={request}
          jellyfinAvailable={jellyfinAvailability[request.tmdb_id ?? 0] ?? false}
        />
      )}
    />
  );
}
```

- [ ] **Step 2: Verify build**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/RequestList.tsx
git commit -m "feat(ui): use StaggerList in RequestList with empty state CTA"
```

---

## Task 4.3: Replace ShowFulfilledCheckbox with Switch

**Files:**
- Modify: `src/components/ShowFulfilledCheckbox.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/ShowFulfilledCheckbox.tsx` with:

```tsx
'use client';

import { Switch } from '@/components/ui/Switch';

interface ShowFulfilledCheckboxProps {
  defaultChecked: boolean;
  query: string;
}

export function ShowFulfilledCheckbox({ defaultChecked, query }: ShowFulfilledCheckboxProps) {
  return (
    <div className="flex items-center gap-3">
      <Switch
        defaultChecked={defaultChecked}
        label="Show fulfilled"
        onCheckedChange={(checked) => {
          const params = new URLSearchParams();
          if (query) params.set('q', query);
          if (checked) params.set('showFulfilled', 'true');
          window.location.search = params.toString();
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Rename file to match new component name**

```bash
git mv src/components/ShowFulfilledCheckbox.tsx src/components/ShowFulfilledSwitch.tsx
```

- [ ] **Step 3: Update import in requests page**

In `src/app/requests/page.tsx`, replace:

```tsx
import { ShowFulfilledCheckbox } from '@/components/ShowFulfilledCheckbox';
```

with:

```tsx
import { ShowFulfilledSwitch } from '@/components/ShowFulfilledSwitch';
```

Also replace the JSX usage in the same file:

```tsx
<ShowFulfilledSwitch
  defaultChecked={showFulfilled}
  query=""
/>
```

- [ ] **Step 4: Verify build**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ShowFulfilledCheckbox.tsx src/components/ShowFulfilledSwitch.tsx src/app/requests/page.tsx
git commit -m "feat(ui): replace fulfilled checkbox with Switch primitive"
```

---

## Task 4.4: Refactor RequestForm to use Input + Button

**Files:**
- Modify: `src/components/RequestForm.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/RequestForm.tsx` with:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

const STORAGE_KEY = 'moviedb-requestor-name';

interface Props {
  onSubmit: (requestedBy: string) => Promise<void>;
  onCancel: () => void;
  isVisible: boolean;
}

export function RequestForm({ onSubmit, onCancel, isVisible }: Props) {
  const [requestedBy, setRequestedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount
      setRequestedBy(stored);
    }
  }, []);

  if (!isVisible) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = requestedBy.trim();
    if (!name) return;
    localStorage.setItem(STORAGE_KEY, name);
    setSubmitting(true);
    try {
      await onSubmit(name);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-muted-foreground">
        <Spinner size="sm" />
        Submitting…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Input
        label="Your name"
        value={requestedBy}
        onChange={(e) => setRequestedBy(e.target.value)}
        placeholder="Your name"
        required
        className="sm:w-56"
      />
      <div className="flex gap-2">
        <Button type="submit" size="md">Submit</Button>
        <Button type="button" size="md" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/RequestForm.tsx
git commit -m "feat(ui): rebuild RequestForm using Input and Button primitives"
```

---

## Task 4.5: Update Pagination to use Button

**Files:**
- Modify: `src/app/components/Pagination.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/app/components/Pagination.tsx` with:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  preserveParams?: Record<string, string>;
}

export function Pagination({ currentPage, totalPages, preserveParams = {} }: PaginationProps) {
  if (totalPages <= 1) return null;

  const buildUrl = (page: number) => {
    const params = new URLSearchParams(preserveParams);
    params.set('page', page.toString());
    return `?${params.toString()}`;
  };

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
      {currentPage > 1 && (
        <Link href={buildUrl(currentPage - 1)}>
          <Button variant="secondary" size="md">Previous</Button>
        </Link>
      )}
      <span className="px-2 text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      {currentPage < totalPages && (
        <Link href={buildUrl(currentPage + 1)}>
          <Button variant="primary" size="md">Next</Button>
        </Link>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/Pagination.tsx
git commit -m "feat(ui): rebuild Pagination with Button primitive"
```

---

## Task 4.6: Remove now-unused JellyfinBadge

**Files:**
- Delete: `src/components/JellyfinBadge.tsx`
- Delete: `src/components/__tests__/JellyfinBadge.test.tsx`

- [ ] **Step 1: Search for any remaining references**

Run: `rg "JellyfinBadge" src/`
Expected: only the two files being deleted; no other references (Pill replaces it everywhere).

If references exist, replace each `JellyfinBadge` import + usage with `Pill variant="available" label="On Jellyfin"`.

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/JellyfinBadge.tsx src/components/__tests__/JellyfinBadge.test.tsx
```

- [ ] **Step 3: Verify build**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(ui): remove JellyfinBadge (replaced by Pill)"
```

---

## Task 4.7: Validate Phase 4

- [ ] **Step 1: Run full check**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 2: Visual smoke test**

Run: `devcontainer exec 'npm run dev'`

In browser at `/requests`:
- Cards fade up in sequence on initial load.
- Touch targets feel right at 375px.
- "Show fulfilled" toggles URL params; pill switches to Switch.
- Action buttons (Download/Fulfill/Cancel) use new Button styles; loading state shows spinner.
- Status pills are coloured (amber=pending, blue=downloading, green=fulfilled, red=canceled).
- Empty state: dashed border, CTA back to search.

- [ ] **Step 3: Tag the milestone**

```bash
git tag phase-4-requests
```

---

# Phase 5 — Polish

## Task 5.1: Add focus-visible ring audit helper

**Files:**
- Create: `src/lib/__tests__/a11y.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { render } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';

describe('a11y', () => {
  it('Button has focus-visible ring class', () => {
    const { container } = render(<Button>x</Button>);
    expect(container.querySelector('button')).toHaveClass('focus-visible:ring-2');
  });

  it('Input has focus-visible ring class', () => {
    const { container } = render(<Input label="x" />);
    expect(container.querySelector('input')).toHaveClass('focus-visible:ring-2');
  });

  it('Switch root has focus-visible ring class', () => {
    const { container } = render(<Switch label="x" />);
    expect(container.querySelector('[role="switch"]')).toHaveClass('focus-visible:ring-2');
  });
});
```

- [ ] **Step 2: Run test**

Run: `devcontainer exec 'npm test -- --testPathPattern=a11y.test'`
Expected: PASS (3/3).

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/a11y.test.tsx
git commit -m "test: verify focus-visible ring on all primitives"
```

---

## Task 5.2: Clean up obsolete CSS classes

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Verify no remaining references**

Run: `rg "btn-primary|btn-secondary|btn-md|btn-sm|btn-action|alert-error|alert-warning|alert-request|badge-success|card-row|page-container|page-title|text-muted|text-year|text-body|nav-link|poster-sm|poster-md|poster-img|form-row|form-row-lg|input|spinner" src/`
Expected: no references in `.tsx` files; only mentions in the CSS file itself or in tests that mock them.

- [ ] **Step 2: Remove the obsolete classes from globals.css**

Delete the entire `@layer components` block from `src/app/globals.css` (lines ~57-179 of the original). Keep `@import "tailwindcss";`, the `@theme` block, and the `@layer base` token block.

- [ ] **Step 3: Verify build**

Run: `devcontainer exec 'npm run check'`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "refactor(ui): remove obsolete component CSS classes (replaced by primitives)"
```

---

## Task 5.3: Bundle size check

- [ ] **Step 1: Build and inspect**

```bash
devcontainer exec 'npm run build'
```

Check the output for:
- First Load JS for `/` and `/requests` pages.
- Verify `motion` is only loaded on client components (not in initial server bundle).

- [ ] **Step 2: Document bundle impact**

Append to the PR description:
- "First Load JS: <X> kB (was <Y> kB before redesign)."
- "motion: <Z> kB gzipped on pages that use it."

If motion is > 50KB gzipped, investigate tree-shaking (`motion/react` import path is correct) and consider lazy-loading `PageTransition` via `next/dynamic`.

---

## Task 5.4: Final validation

- [ ] **Step 1: Run full check one more time**

Run: `devcontainer exec 'npm run check'`
Expected: PASS, 0 warnings, 0 errors.

- [ ] **Step 2: Manual a11y walkthrough**

Run: `devcontainer exec 'npm run dev'`

Verify:
- Tab through every page — focus ring visible on every interactive element.
- Toggle `prefers-reduced-motion: reduce` in dev tools — no motion, fully usable.
- Use VoiceOver (macOS) or NVDA (Windows) on both pages — all controls announced.
- Run Lighthouse in Chrome — Performance ≥ 90, Accessibility ≥ 95.

- [ ] **Step 3: Tag final milestone**

```bash
git tag ui-overhaul-complete
```

---

## Self-Review

**Spec coverage check** (one task per spec section):

| Spec section | Tasks |
|---|---|
| §2 Warm Cinema tokens | 1.3 |
| §3 Architecture (Motion) | 1.1, 1.10, 1.11, 1.12 |
| §3 Component primitives | 1.4–1.9 |
| §3 Page structure | 2.1, 2.2 |
| §4 Two-thirds hero | 3.1 |
| §5 Horizontal row list | 4.1, 4.2 |
| §6 Component specs (Button/Input/Pill/Surface/Spinner/Switch) | 1.4–1.9, 4.3, 4.4, 4.5 |
| §7 Motion tokens | 1.3 (durations), 1.10 (variants) |
| §8 Accessibility | 5.1, 5.4 |
| §9 Performance | 5.3 |
| §10 Testing | Each task has its own test; 5.1 adds cross-cutting a11y tests |
| §11 Migration phases | Phase 1–5 boundaries match |
| §13 File inventory | All new/modified/removed files covered |

**Placeholder scan:** No "TBD", "TODO", "implement later" in any task. Every code block is complete. Every test is concrete.

**Type consistency:**
- `Button` props: `variant`, `size`, `loading`, `disabled`, `className` — used consistently across all components and tests.
- `Pill` props: `variant`, `label` — used consistently.
- `Surface` props: `elevation`, `as`, `className` — used consistently.
- `Switch` props: `label`, `checked`/`defaultChecked`, `onCheckedChange`, `disabled`, `id` — used consistently.
- `StaggerList` props: `items`, `renderItem`, `className` — used consistently in both call sites.
- Variant types: `PILL_VARIANT` and `ACTION_VARIANT` defined once in `RequestCard`, used there only.
- File rename: `ShowFulfilledCheckbox.tsx` → `ShowFulfilledSwitch.tsx` with import update in one consumer.

**Gaps found and fixed during self-review:**
- Spec mentions `framer-motion`; plan uses `motion` (the new package name). This matches AGENTS.md preferring current packages and the `motion` install command in Task 1.1.
- Spec has `JellyfinBadge` listed in "Modified" but it should be removed (replaced by Pill). Task 4.6 handles this.
- Spec lists `ShowFulfilledCheckbox` in "Modified" but the file is renamed to `ShowFulfilledSwitch`. Task 4.3 covers rename + import update.

No outstanding issues.
