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
