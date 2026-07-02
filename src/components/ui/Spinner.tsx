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
