import { Prisma, PrismaClient } from '@/generated/prisma/client';

import { logger } from '@/lib/logger';
import { createTmdbClient, TmdbClient } from '@/lib/tmdb';

import { Request, toRequestModel } from './projection';
import {
  CreateRequestInput,
  validateCreateRequestInput,
  validateRequestedBy,
} from './validators';

export type EnqueueJob = (
  tx: Prisma.TransactionClient,
  type: string,
  payload: Prisma.InputJsonValue,
) => Promise<void>;

export interface RequestIntakeDeps {
  prisma: PrismaClient;
  enqueueJob: EnqueueJob;
  tmdb?: TmdbClient;
}

export interface RequestIntake {
  createRequest(input: CreateRequestInput): Promise<Request>;
  createTvRequests(tmdbId: number, requestedBy: string): Promise<Request[]>;
}

export function createRequestIntake({
  prisma,
  enqueueJob,
  tmdb,
}: RequestIntakeDeps): RequestIntake {
  async function createRequest(input: CreateRequestInput): Promise<Request> {
    const validation = validateCreateRequestInput(input);
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    const existing = await prisma.request.findFirst({
      where: {
        tmdb_id: input.tmdbId,
        season_number: input.seasonNumber ?? null,
      },
    });
    if (existing) {
      logger.info(
        { tmdbId: input.tmdbId, seasonNumber: input.seasonNumber, title: input.title, requestId: existing.id },
        'Request already exists',
      );
      return toRequestModel(existing);
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.request.create({
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

      await enqueueJob(tx, 'request_notification', { ...row } as Prisma.InputJsonValue);

      return row;
    });

    logger.info(
      {
        requestId: created.id,
        tmdbId: input.tmdbId,
        seasonNumber: input.seasonNumber,
        title: input.title,
        mediaType: input.mediaType,
        requestedBy: input.requestedBy,
      },
      'Request created',
    );

    return toRequestModel(created);
  }

  async function createTvRequests(tmdbId: number, requestedBy: string): Promise<Request[]> {
    const validation = validateRequestedBy(requestedBy);
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    const details = await (tmdb ?? createTmdbClient()).tvDetails(tmdbId);
    const seasons = details.seasons.filter((s) => s.season_number > 0);

    const rows = await prisma.$transaction(async (tx) => {
      const created: Awaited<ReturnType<typeof tx.request.create>>[] = [];

      for (const season of seasons) {
        const existing = await tx.request.findFirst({
          where: { tmdb_id: tmdbId, season_number: season.season_number },
        });

        if (existing) {
          created.push(existing);
          continue;
        }

        const row = await tx.request.create({
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
        created.push(row);
      }

      await enqueueJob(tx, 'tv_series_request_notification', {
        title: details.name,
        requestedBy,
        seasons: seasons.map((s) => s.season_number),
        totalSeasons: seasons.length,
        posterPath: details.poster_path ?? null,
        releaseDate: details.first_air_date ?? null,
      } as Prisma.InputJsonValue);

      return created;
    });

    logger.info({ tmdbId, seasonCount: seasons.length, requestedBy }, 'TV show fan-out complete');

    return rows.map(toRequestModel);
  }

  return {
    createRequest,
    createTvRequests,
  };
}
