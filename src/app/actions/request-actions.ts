'use server';

import {
  createRequest as createRequestImpl,
  fulfillRequest as fulfillRequestImpl,
  downloadRequest as downloadRequestImpl,
  cancelRequest as cancelRequestImpl,
} from '@/lib/request-service';

export async function createRequest(
  tmdbId: number,
  title: string,
  posterPath: string | null,
  requestedBy: string
) {
  return createRequestImpl({ tmdbId, title, posterPath, requestedBy });
}

export async function fulfillRequest(requestId: number) {
  return fulfillRequestImpl(requestId);
}

export async function downloadRequest(requestId: number) {
  return downloadRequestImpl(requestId);
}

export async function cancelRequest(requestId: number) {
  return cancelRequestImpl(requestId);
}
