'use client';

import { useRouter } from 'next/navigation';
import RequestCard from '@/components/RequestCard';
import { logger } from '@/lib/logger';
import { fulfillRequest, downloadRequest, cancelRequest } from '@/app/actions/request-actions';
import { Request } from '@/types/request';

interface RequestDetailProps {
  request: Request;
  jellyfinAvailable: boolean;
}

export default function RequestDetail({ request, jellyfinAvailable }: RequestDetailProps) {
  const router = useRouter();

  const handleMarkFulfilled = async () => {
    try {
      await fulfillRequest(request.id);
      router.refresh();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to mark as fulfilled');
      throw error;
    }
  };

  const handleDownload = async () => {
    try {
      await downloadRequest(request.id);
      router.refresh();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to download');
      throw error;
    }
  };

  const handleCancel = async () => {
    try {
      await cancelRequest(request.id);
      router.push('/requests');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cancel');
      throw error;
    }
  };

  return (
    <RequestCard
      request={request}
      onMarkFulfilled={handleMarkFulfilled}
      onDownload={handleDownload}
      onCancel={handleCancel}
      jellyfinAvailable={jellyfinAvailable}
    />
  );
}
