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
