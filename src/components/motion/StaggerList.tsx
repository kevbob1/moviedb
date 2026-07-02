'use client';

import { Children, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '@/lib/motion';
import { fadeUp, stagger } from './variants';

interface StaggerListProps {
  children: ReactNode;
  className?: string;
}

export function StaggerList({ children, className }: StaggerListProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      role="list"
      variants={stagger}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        const key = child.key ?? i;
        return (
          <motion.div key={key} variants={reduced ? undefined : fadeUp}>
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
