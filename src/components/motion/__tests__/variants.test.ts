import { fadeUp, stagger, scaleTap, getVariants } from '@/components/motion/variants';

describe('motion variants', () => {
  it('fadeUp defines hidden and visible', () => {
    expect(fadeUp).toHaveProperty('hidden');
    expect(fadeUp).toHaveProperty('visible');
  });

  it('stagger defines visible transition', () => {
    expect((stagger.visible as { transition: { staggerChildren: number } }).transition).toBeDefined();
    expect((stagger.visible as { transition: { staggerChildren: number } }).transition.staggerChildren).toBeGreaterThan(0);
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
