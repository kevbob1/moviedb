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
