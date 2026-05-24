import { RequestStatus } from './request-fsm';

export const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-800', bgColor: 'bg-yellow-100' },
  downloading: { label: 'Downloading', color: 'text-blue-800', bgColor: 'bg-blue-100' },
  fulfilled: { label: 'Fulfilled', color: 'text-green-800', bgColor: 'bg-green-100' },
  canceled: { label: 'Canceled', color: 'text-red-800', bgColor: 'bg-red-100' },
};