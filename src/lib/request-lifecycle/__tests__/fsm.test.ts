import {
  REQUEST_TRANSITIONS,
  canTransition,
  getAllowedTransitions,
  InvalidTransitionError,
  resolveSideEffects,
} from '../fsm';

describe('request-lifecycle/fsm', () => {
  describe('REQUEST_TRANSITIONS', () => {
    it('defines pending transitions correctly', () => {
      expect(REQUEST_TRANSITIONS.pending).toEqual(['downloading', 'fulfilled']);
    });

    it('defines downloading transitions correctly', () => {
      expect(REQUEST_TRANSITIONS.downloading).toEqual(['fulfilled']);
    });

    it('defines fulfilled with no transitions', () => {
      expect(REQUEST_TRANSITIONS.fulfilled).toEqual([]);
    });
  });

  describe('canTransition', () => {
    it('allows valid pending transitions', () => {
      expect(canTransition('pending', 'downloading')).toBe(true);
      expect(canTransition('pending', 'fulfilled')).toBe(true);
    });

    it('allows valid downloading transitions', () => {
      expect(canTransition('downloading', 'fulfilled')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(canTransition('fulfilled', 'downloading')).toBe(false);
      expect(canTransition('pending', 'pending')).toBe(false);
      expect(canTransition('downloading', 'downloading')).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns correct transitions for pending', () => {
      expect(getAllowedTransitions('pending')).toEqual(['downloading', 'fulfilled']);
    });

    it('returns empty array for fulfilled', () => {
      expect(getAllowedTransitions('fulfilled')).toEqual([]);
    });
  });

  describe('InvalidTransitionError', () => {
    it('is an Error subclass with the right name', () => {
      const err = new InvalidTransitionError('nope');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(InvalidTransitionError);
      expect(err.name).toBe('InvalidTransitionError');
      expect(err.message).toBe('nope');
    });
  });

  describe('resolveSideEffects', () => {
    const fixedNow = () => new Date('2026-01-01T00:00:00Z');

    it('sets resolved_at on the fulfill transition', () => {
      const fx = resolveSideEffects('fulfilled', fixedNow);
      expect(fx).toEqual({
        status: 'fulfilled',
        torrent_problem: null,
        resolved_at: new Date('2026-01-01T00:00:00Z'),
      });
    });

    it('clears torrent_problem on a non-fulfill transition', () => {
      const fx = resolveSideEffects('downloading', fixedNow);
      expect(fx).toEqual({
        status: 'downloading',
        torrent_problem: null,
      });
      expect(fx).not.toHaveProperty('resolved_at');
    });

    it('uses the injected clock', () => {
      const later: Date = resolveSideEffects('fulfilled', () => new Date('2030-05-05T05:05:05Z')).resolved_at!;
      expect(later.toISOString()).toBe('2030-05-05T05:05:05.000Z');
    });
  });
});