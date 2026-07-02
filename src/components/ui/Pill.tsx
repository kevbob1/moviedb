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
  label?: string;
}

export function Pill({ variant, label, className, children, ...props }: PillProps) {
  const text = label ?? children;
  return (
    <span
      className={cn(pillVariants({ variant }), className)}
      role="status"
      aria-label={`Status: ${text}`}
      {...props}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', DOT_COLORS[variant ?? 'pending'])} />
      <span>{text}</span>
    </span>
  );
}
