jest.mock('@/app/actions/request-actions', () => ({
  cancelRequest: jest.fn(),
  downloadRequest: jest.fn(),
  fulfillRequest: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { act, renderHook } from '@testing-library/react';

import { cancelRequest } from '@/app/actions/request-actions';
import { logger } from '@/lib/logger';
import { useRequestActions } from '../use-request-actions';

describe('useRequestActions coverage edges', () => {
  it('logs a non-Error action failure as text and still clears pending', async () => {
    (cancelRequest as jest.Mock).mockRejectedValueOnce('network down');
    const onAfterCancel = jest.fn();

    const { result } = renderHook(() =>
      useRequestActions({
        request: { id: 1 } as never,
        onAfterCancel,
      }),
    );

    await act(async () => {
      await result.current.cancel();
    });

    expect(logger.error).toHaveBeenCalledWith({ error: 'network down' }, 'Failed to cancel');
    expect(result.current.isPending).toBe(false);
    expect(onAfterCancel).toHaveBeenCalled();
  });
});
