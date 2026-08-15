'use server';

import { revalidatePath } from 'next/cache';

import { requestService } from '@/lib/request-lifecycle';
import { CreateRequestInput } from '@/lib/request-lifecycle/validators';

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
  const input: CreateRequestInput = {
    tmdbId,
    title,
    posterPath,
    requestedBy,
    releaseDate,
    overview,
    genreIds,
    mediaType,
    seasonNumber,
  };
  return requestService.createRequest(input);
}

export async function createTvShowRequests(tmdbId: number, requestedBy: string) {
  const result = await requestService.createTvRequests(tmdbId, requestedBy);
  revalidatePath('/requests');
  return result;
}

export async function fulfillRequest(requestId: number) {
  const result = await requestService.fulfillRequest(requestId);
  revalidatePath('/requests');
  return result;
}

export async function downloadRequest(requestId: number) {
  const result = await requestService.downloadRequest(requestId);
  revalidatePath('/requests');
  return result;
}

export async function cancelRequest(requestId: number) {
  await requestService.cancelRequest(requestId);
  revalidatePath('/requests');
  revalidatePath('/needs-match');
}

export async function linkTorrent(requestId: number, torrentHash: string) {
  const result = await requestService.linkTorrent(requestId, torrentHash);
  revalidatePath('/needs-match');
  revalidatePath('/');
  return result;
}