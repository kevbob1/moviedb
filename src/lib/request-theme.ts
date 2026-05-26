import { RequestStatus } from './request-fsm';

export const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-800 dark:text-yellow-200', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  downloading: { label: 'Downloading', color: 'text-blue-800 dark:text-blue-200', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  fulfilled: { label: 'Fulfilled', color: 'text-green-800 dark:text-green-200', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  canceled: { label: 'Canceled', color: 'text-red-800 dark:text-red-200', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};