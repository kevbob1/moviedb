'use server';

import { prisma } from '@/lib/prisma';
import { canTransition, RequestStatus } from '@/lib/request-fsm';

export async function createRequest(
  tmdbId: number,
  title: string,
  posterPath: string | null,
  requestedBy: string
) {
  if (!title.trim() || !requestedBy.trim()) {
    throw new Error('Title and requester name are required');
  }

  return prisma.request.create({
    data: {
      tmdb_id: tmdbId,
      title,
      poster_path: posterPath,
      requested_by: requestedBy,
      status: 'pending',
      media_type: 'movie',
    },
  });
}

export async function fulfillRequest(requestId: number) {
  const request = await prisma.request.findUnique({ where: { id: requestId } });

  if (!request) {
    throw new Error('Request not found');
  }

  const currentStatus = request.status as RequestStatus;

  if (!canTransition(currentStatus, 'fulfilled')) {
    throw new Error(`Cannot transition from ${currentStatus} to fulfilled`);
  }

  return prisma.request.update({
    where: { id: requestId },
    data: { status: 'fulfilled' },
  });
}

export async function downloadRequest(requestId: number) {
  const request = await prisma.request.findUnique({ where: { id: requestId } });

  if (!request) {
    throw new Error('Request not found');
  }

  const currentStatus = request.status as RequestStatus;

  if (!canTransition(currentStatus, 'downloading')) {
    throw new Error(`Cannot transition from ${currentStatus} to downloading`);
  }

  return prisma.request.update({
    where: { id: requestId },
    data: { status: 'downloading' },
  });
}

export async function cancelRequest(requestId: number) {
  const request = await prisma.request.findUnique({ where: { id: requestId } });

  if (!request) {
    throw new Error('Request not found');
  }

  const currentStatus = request.status as RequestStatus;

  if (!canTransition(currentStatus, 'canceled')) {
    throw new Error(`Cannot cancel request in status ${currentStatus}`);
  }

  return prisma.request.update({
    where: { id: requestId },
    data: { status: 'canceled' },
  });
}
