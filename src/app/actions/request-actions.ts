'use server';

import { revalidatePath } from 'next/cache';
import {
  createRequest as createRequestImpl,
  fulfillRequest as fulfillRequestImpl,
  downloadRequest as downloadRequestImpl,
  cancelRequest as cancelRequestImpl,
  createTvRequests,
} from '@/lib/request-service';

export async function createRequest(
  tmdbId: number,
  title: string,
  posterPath: string | null,
  requestedBy: string,
  releaseDate?: string,
  overview?: string,
  genreIds?: number[],
  mediaType: string = 'movie',
  seasonNumber?: number
) {
  return createRequestImpl({
    tmdbId,
    title,
    posterPath,
    requestedBy,
    releaseDate,
    overview,
    genreIds,
    mediaType,
    seasonNumber,
  });
}

export async function createTvShowRequests(tmdbId: number, requestedBy: string) {
  const result = await createTvRequests(tmdbId, requestedBy);
  revalidatePath('/requests');
  return result;
}

export async function fulfillRequest(requestId: number) {
  const result = await fulfillRequestImpl(requestId);
  revalidatePath('/requests');
  return result;
}

export async function downloadRequest(requestId: number) {
  const result = await downloadRequestImpl(requestId);
  revalidatePath('/requests');
  return result;
}

export async function cancelRequest(requestId: number) {
  const result = await cancelRequestImpl(requestId);
  revalidatePath('/requests');
  return result;
}
