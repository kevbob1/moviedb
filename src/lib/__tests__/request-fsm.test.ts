import {
  RequestStatus,
  canTransition,
  getAllowedTransitions,
  getActionsForStatus,
  STATUS_CONFIG,
  REQUEST_TRANSITIONS
} from '../request-fsm';

describe('request-fsm', () => {
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

  describe('getActionsForStatus', () => {
    it('returns download and fulfill (no cancel) for pending', () => {
      const actions = getActionsForStatus('pending');
      const actionLabels = actions.map(a => a.label);
      expect(actionLabels).toContain('Start Download');
      expect(actionLabels).toContain('Mark Fulfilled');
      expect(actionLabels).not.toContain('Cancel');
    });

    it('returns fulfill (no cancel) for downloading', () => {
      const actions = getActionsForStatus('downloading');
      const actionLabels = actions.map(a => a.label);
      expect(actionLabels).toContain('Mark Fulfilled');
      expect(actionLabels).not.toContain('Cancel');
      expect(actionLabels).not.toContain('Start Download');
    });

    it('returns empty array for fulfilled', () => {
      expect(getActionsForStatus('fulfilled')).toEqual([]);
    });
  });

  describe('STATUS_CONFIG', () => {
    it('includes config for all statuses', () => {
      const statuses: RequestStatus[] = ['pending', 'downloading', 'fulfilled'];
      statuses.forEach(status => {
        expect(STATUS_CONFIG[status]).toBeDefined();
        expect(STATUS_CONFIG[status]).toHaveProperty('label');
        expect(STATUS_CONFIG[status]).toHaveProperty('color');
        expect(STATUS_CONFIG[status]).toHaveProperty('bgColor');
      });
    });
  });
});
