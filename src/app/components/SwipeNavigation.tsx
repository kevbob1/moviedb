'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useReducedMotion } from '@/lib/motion';

const ROUTES = ['/', '/requests'] as const;

const SWIPE_THRESHOLD = 80;
const EDGE_THRESHOLD = 60;

const slideVariants = {
  enter: (direction: 'next' | 'previous') => ({
    x: direction === 'next' ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 'next' | 'previous') => ({
    x: direction === 'next' ? -300 : 300,
    opacity: 0,
  }),
};

export function SwipeNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduced = useReducedMotion();
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const [direction, setDirection] = useState<'next' | 'previous'>('next');

  const navigate = useCallback(
    (dir: 'next' | 'previous') => {
      const idx = ROUTES.indexOf(pathname as (typeof ROUTES)[number]);
      if (idx === -1) return;
      const target =
        dir === 'next'
          ? idx < ROUTES.length - 1
            ? ROUTES[idx + 1]
            : null
          : idx > 0
            ? ROUTES[idx - 1]
            : null;
      if (target && target !== pathname) {
        setDirection(dir);
        router.push(target);
      }
    },
    [pathname, router],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    tracking.current = true;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!tracking.current) return;
      tracking.current = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (Math.abs(dx) < Math.abs(dy)) return;
      if (Math.abs(startX.current) < EDGE_THRESHOLD || startX.current > window.innerWidth - EDGE_THRESHOLD) return;
      if (dx > 0) {
        navigate('previous');
      } else {
        navigate('next');
      }
    },
    [navigate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigate('previous');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigate('next');
      }
    },
    [navigate],
  );

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      className="min-h-[60vh] outline-none overflow-hidden"
      tabIndex={-1}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={pathname}
          custom={direction}
          variants={reduced ? undefined : slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduced ? 0 : 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
