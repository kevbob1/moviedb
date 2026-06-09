import { prisma } from '@/lib/prisma';
import { canTransition, RequestStatus } from '@/lib/request-fsm';
import { sendRequestNotification } from './notifications';
import { logger } from './logger';
import { getTMDBTVDetails } from './tmdb';

export interface CreateRequestInput {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  requestedBy: string;
  releaseDate?: string;
  overview?: string;
  genreIds?: number[];
  mediaType: string;
  seasonNumber?: number;
}

export async function createRequest(input: CreateRequestInput) {
  if (!input.title?.trim() || !input.requestedBy?.trim()) {
    throw new Error('Title and requester name are required');
  }

  const existing = await prisma.request.findFirst({
    where: {
      tmdb_id: input.tmdbId,
      season_number: input.seasonNumber ?? null,
    },
  });
  if (existing) {
    logger.info({ tmdbId: input.tmdbId, seasonNumber: input.seasonNumber, title: input.title, requestId: existing.id }, 'Request already exists');
    return existing;
  }

  const created = await prisma.request.create({
    data: {
      tmdb_id: input.tmdbId,
      title: input.title,
      poster_path: input.posterPath,
      requested_by: input.requestedBy,
      status: 'pending',
      media_type: input.mediaType,
      season_number: input.seasonNumber ?? null,
      release_date: input.releaseDate,
      overview: input.overview,
      genre_ids: input.genreIds ?? [],
    },
  });

  logger.info({ requestId: created.id, tmdbId: input.tmdbId, seasonNumber: input.seasonNumber, title: input.title, mediaType: input.mediaType, requestedBy: input.requestedBy }, 'Request created');

  await sendRequestNotification(created);

  return created;
}

export async function createTvRequests(tmdbId: number, requestedBy: string) {
  if (!requestedBy?.trim()) {
    throw new Error('Requester name is required');
  }

  const details = await getTMDBTVDetails(tmdbId);
  const seasons = details.seasons.filter(s => s.season_number > 0);

  const results: Awaited<ReturnType<typeof createRequest>>[] = [];

  for (const season of seasons) {
    const input: CreateRequestInput = {
      tmdbId,
      title: details.name,
      posterPath: season.poster_path ?? null,
      requestedBy,
      releaseDate: undefined,
      overview: undefined,
      genreIds: undefined,
      mediaType: 'tv',
      seasonNumber: season.season_number,
    };

    const existing = await prisma.request.findFirst({
      where: { tmdb_id: tmdbId, season_number: season.season_number },
    });

    if (existing) {
      results.push(existing);
      continue;
    }

    const created = await createRequest(input);
    results.push(created);
  }

  logger.info({ tmdbId, seasonCount: seasons.length, requestedBy }, 'TV show fan-out complete');

  return results;
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