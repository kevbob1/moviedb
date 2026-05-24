export type RequestStatus = 'pending' | 'downloading' | 'fulfilled' | 'canceled';

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

export const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-800', bgColor: 'bg-yellow-100' },
  downloading: { label: 'Downloading', color: 'text-blue-800', bgColor: 'bg-blue-100' },
  fulfilled: { label: 'Fulfilled', color: 'text-green-800', bgColor: 'bg-green-100' },
  canceled: { label: 'Canceled', color: 'text-red-800', bgColor: 'bg-red-100' },
};
