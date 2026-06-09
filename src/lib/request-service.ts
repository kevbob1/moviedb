import { prisma } from '@/lib/prisma';
import { canTransition, RequestStatus } from '@/lib/request-fsm';
import { logger } from './logger';
import { getTMDBTVDetails } from './tmdb';

import './jobs';

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

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.request.create({
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

    await tx.job.create({
      data: {
        type: 'request_notification',
        payload: { ...request },
        status: 'pending',
      },
    });

    return request;
  });

  logger.info({ requestId: created.id, tmdbId: input.tmdbId, seasonNumber: input.seasonNumber, title: input.title, mediaType: input.mediaType, requestedBy: input.requestedBy }, 'Request created');

  return created;
}

export async function createTvRequests(tmdbId: number, requestedBy: string) {
  if (!requestedBy?.trim()) {
    throw new Error('Requester name is required');
  }

  const details = await getTMDBTVDetails(tmdbId);
  const seasons = details.seasons.filter(s => s.season_number > 0);

  const results = await prisma.$transaction(async (tx) => {
    const created: Awaited<ReturnType<typeof tx.request.create>>[] = [];

    for (const season of seasons) {
      const existing = await tx.request.findFirst({
        where: { tmdb_id: tmdbId, season_number: season.season_number },
      });

      if (existing) {
        created.push(existing);
        continue;
      }

      const req = await tx.request.create({
        data: {
          tmdb_id: tmdbId,
          title: details.name,
          poster_path: season.poster_path ?? null,
          requested_by: requestedBy,
          status: 'pending',
          media_type: 'tv',
          season_number: season.season_number,
        },
      });
      created.push(req);
    }

    await tx.job.create({
      data: {
        type: 'tv_series_request_notification',
        payload: {
          title: details.name,
          requestedBy,
          seasons: seasons.map(s => s.season_number),
          totalSeasons: seasons.length,
          posterPath: details.poster_path ?? null,
          releaseDate: details.first_air_date ?? null,
        },
        status: 'pending',
      },
    });

    return created;
  });

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
