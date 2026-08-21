export type RequestStatus = 'pending' | 'downloading' | 'fulfilled';

export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ['downloading', 'fulfilled'],
  downloading: ['fulfilled'],
  fulfilled: [],
};

export const canTransition = (from: RequestStatus, to: RequestStatus): boolean => {
  return REQUEST_TRANSITIONS[from].includes(to);
};

export const getAllowedTransitions = (status: RequestStatus): RequestStatus[] => {
  return REQUEST_TRANSITIONS[status];
};

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

export interface TransitionSideEffects {
  status: RequestStatus;
  torrent_problem: string | null;
  resolved_at?: Date;
  suggestion_hash: string | null;
  suggestion_score: number | null;
  suggestion_computed_at: Date | null;
}

export const resolveSideEffects = (to: RequestStatus, now: () => Date): TransitionSideEffects => {
  const base: TransitionSideEffects = {
    status: to,
    torrent_problem: null,
    suggestion_hash: null,
    suggestion_score: null,
    suggestion_computed_at: null,
  };
  if (to === 'fulfilled') {
    return { ...base, resolved_at: now() };
  }
  return base;
};