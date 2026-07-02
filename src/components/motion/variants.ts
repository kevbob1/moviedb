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
