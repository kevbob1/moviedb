export type RequestStatus = 'pending' | 'downloading' | 'fulfilled' | 'canceled';

export { STATUS_CONFIG } from './request-theme';

export interface Transition {
  action: string;
  label: string;
  nextStatus: RequestStatus;
}

export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ['downloading', 'fulfilled', 'canceled'],
  downloading: ['fulfilled', 'canceled'],
  fulfilled: [],
  canceled: [],
};

export const canTransition = (from: RequestStatus, to: RequestStatus): boolean => {
  return REQUEST_TRANSITIONS[from].includes(to);
};

export const getAllowedTransitions = (status: RequestStatus): RequestStatus[] => {
  return REQUEST_TRANSITIONS[status];
};

export const getActionsForStatus = (status: RequestStatus): Transition[] => {
  const actions: Transition[] = [];

  if (status === 'pending') {
    actions.push(
      { action: 'download', label: 'Start Download', nextStatus: 'downloading' },
      { action: 'fulfill', label: 'Mark Fulfilled', nextStatus: 'fulfilled' },
      { action: 'cancel', label: 'Cancel', nextStatus: 'canceled' }
    );
  } else if (status === 'downloading') {
    actions.push(
      { action: 'fulfill', label: 'Mark Fulfilled', nextStatus: 'fulfilled' },
      { action: 'cancel', label: 'Cancel', nextStatus: 'canceled' }
    );
  }

  return actions;
};
