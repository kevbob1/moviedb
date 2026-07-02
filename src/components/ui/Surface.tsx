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
