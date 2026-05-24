'use server';

import { prisma } from '@/lib/prisma';

export async function createRequest(
  tmdbId: number | null,
  title: string,
  posterPath: string | null,
  requestedBy: string
) {
  if (!title?.trim() || !requestedBy?.trim()) {
    throw new Error('Title and requested_by are required');
  }

  return prisma.request.create({
    data: {
      tmdb_id: tmdbId,
      title,
      poster_path: posterPath,
      requested_by: requestedBy,
      status: 'pending',
      media_type: 'movie'
    }
  });
}

export async function fulfillRequest(requestId: number) {
  return prisma.request.update({
    where: { id: requestId },
    data: { status: 'fulfilled' }
  });
}
