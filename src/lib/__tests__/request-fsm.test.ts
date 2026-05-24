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
      expect(REQUEST_TRANSITIONS.pending).toEqual(['downloading', 'fulfilled', 'canceled']);
    });

    it('defines downloading transitions correctly', () => {
      expect(REQUEST_TRANSITIONS.downloading).toEqual(['fulfilled', 'canceled']);
    });

    it('defines terminal states with no transitions', () => {
      expect(REQUEST_TRANSITIONS.fulfilled).toEqual([]);
      expect(REQUEST_TRANSITIONS.canceled).toEqual([]);
    });
  });

  describe('canTransition', () => {
    it('allows valid pending transitions', () => {
      expect(canTransition('pending', 'downloading')).toBe(true);
      expect(canTransition('pending', 'fulfilled')).toBe(true);
      expect(canTransition('pending', 'canceled')).toBe(true);
    });

    it('allows valid downloading transitions', () => {
      expect(canTransition('downloading', 'fulfilled')).toBe(true);
      expect(canTransition('downloading', 'canceled')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(canTransition('fulfilled', 'downloading')).toBe(false);
      expect(canTransition('canceled', 'pending')).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns correct transitions for pending', () => {
      expect(getAllowedTransitions('pending')).toEqual(['downloading', 'fulfilled', 'canceled']);
    });

    it('returns empty array for terminal states', () => {
      expect(getAllowedTransitions('fulfilled')).toEqual([]);
      expect(getAllowedTransitions('canceled')).toEqual([]);
    });
  });

  describe('getActionsForStatus', () => {
    it('returns download, fulfill, cancel for pending', () => {
      const actions = getActionsForStatus('pending');
      const actionLabels = actions.map(a => a.label);
      expect(actionLabels).toContain('Start Download');
      expect(actionLabels).toContain('Mark Fulfilled');
      expect(actionLabels).toContain('Cancel');
    });

    it('returns fulfill and cancel for downloading', () => {
      const actions = getActionsForStatus('downloading');
      const actionLabels = actions.map(a => a.label);
      expect(actionLabels).toContain('Mark Fulfilled');
      expect(actionLabels).toContain('Cancel');
      expect(actionLabels).not.toContain('Start Download');
    });

    it('returns empty array for terminal states', () => {
      expect(getActionsForStatus('fulfilled')).toEqual([]);
      expect(getActionsForStatus('canceled')).toEqual([]);
    });
  });

  describe('STATUS_CONFIG', () => {
    it('includes config for all statuses', () => {
      const statuses: RequestStatus[] = ['pending', 'downloading', 'fulfilled', 'canceled'];
      statuses.forEach(status => {
        expect(STATUS_CONFIG[status]).toBeDefined();
        expect(STATUS_CONFIG[status]).toHaveProperty('label');
        expect(STATUS_CONFIG[status]).toHaveProperty('color');
        expect(STATUS_CONFIG[status]).toHaveProperty('bgColor');
      });
    });
  });
});
