import { RequestStatus } from './request-fsm';

export const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-status-pending-text', bgColor: 'bg-status-pending-bg' },
  downloading: { label: 'Downloading', color: 'text-status-downloading-text', bgColor: 'bg-status-downloading-bg' },
  fulfilled: { label: 'Fulfilled', color: 'text-status-fulfilled-text', bgColor: 'bg-status-fulfilled-bg' },
  canceled: { label: 'Canceled', color: 'text-status-canceled-text', bgColor: 'bg-status-canceled-bg' },
};