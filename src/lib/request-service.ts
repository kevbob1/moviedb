import { prisma } from '@/lib/prisma';
import { canTransition, RequestStatus } from '@/lib/request-fsm';
import { sendRequestNotification } from './notifications';

export interface CreateRequestInput {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  requestedBy: string;
  releaseDate?: string;
  overview?: string;
  genreIds?: number[];
}

export async function createRequest(input: CreateRequestInput) {
  if (!input.title?.trim() || !input.requestedBy?.trim()) {
    throw new Error('Title and requester name are required');
  }

  const existing = await prisma.request.findUnique({ where: { tmdb_id: input.tmdbId } });
  if (existing) {
    return existing;
  }

  const created = await prisma.request.create({
    data: {
      tmdb_id: input.tmdbId,
      title: input.title,
      poster_path: input.posterPath,
      requested_by: input.requestedBy,
      status: 'pending',
      media_type: 'movie',
      release_date: input.releaseDate,
      overview: input.overview,
      genre_ids: input.genreIds ?? [],
    },
  });

  await sendRequestNotification(created);

  return created;
}

export async function transitionToStatus(requestId: number, targetStatus: RequestStatus) {
  const request = await prisma.request.findUnique({ where: { id: requestId } });

  if (!request) {
    throw new Error('Request not found');
  }

  const currentStatus = request.status as RequestStatus;

  if (!canTransition(currentStatus, targetStatus)) {
    throw new Error(`Cannot transition from ${currentStatus} to ${targetStatus}`);
  }

  return prisma.request.update({
    where: { id: requestId },
    data: { status: targetStatus },
  });
}

export async function fulfillRequest(requestId: number) {
  return transitionToStatus(requestId, 'fulfilled');
}

export async function downloadRequest(requestId: number) {
  return transitionToStatus(requestId, 'downloading');
}

export async function cancelRequest(requestId: number) {
  return transitionToStatus(requestId, 'canceled');
}