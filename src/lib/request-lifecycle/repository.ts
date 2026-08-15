import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getTMDBTVDetails } from '@/lib/tmdb';
import { logger } from '@/lib/logger';
import {
  canTransition,
  InvalidTransitionError,
  RequestStatus,
  resolveSideEffects,
} from './fsm';
import { Request, toRequestModel } from './projection';
import { CreateRequestInput, validateCreateRequestInput, validateRequestedBy } from './validators';

export type EnqueueJob = (
  tx: Prisma.TransactionClient,
  type: string,
  payload: Prisma.InputJsonValue,
) => Promise<void>;

export interface RequestServiceDeps {
  prisma: PrismaClient;
  enqueueJob: EnqueueJob;
  now?: () => Date;
}

export interface RequestService {
  createRequest(input: CreateRequestInput): Promise<Request>;
  createTvRequests(tmdbId: number, requestedBy: string): Promise<Request[]>;
  linkTorrent(reqId: number, torrentHash: string): Promise<Request>;
  transitionToStatus(reqId: number, target: RequestStatus): Promise<Request>;
  fulfillRequest(reqId: number): Promise<Request>;
  downloadRequest(reqId: number): Promise<Request>;
  cancelRequest(reqId: number): Promise<void>;
  fulfillBySync(reqId: number, tx: Prisma.TransactionClient): Promise<void>;
  flagTorrentProblem(reqId: number, problem: string, tx: Prisma.TransactionClient): Promise<void>;
}

export function createRequestService({ prisma, enqueueJob, now = () => new Date() }: RequestServiceDeps): RequestService {
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
        'Request already exists'
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
      'Request created'
    );

    return toRequestModel(created);
  }

  async function createTvRequests(tmdbId: number, requestedBy: string): Promise<Request[]> {
    const validation = validateRequestedBy(requestedBy);
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    const details = await getTMDBTVDetails(tmdbId);
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

  async function transitionToStatus(reqId: number, target: RequestStatus): Promise<Request> {
    const existing = await prisma.request.findUnique({ where: { id: reqId } });
    if (!existing) {
      throw new Error('Request not found');
    }

    const from = existing.status as RequestStatus;
    if (!canTransition(from, target)) {
      throw new InvalidTransitionError(`Cannot transition from ${from} to ${target}`);
    }

    const sideEffects = resolveSideEffects(target, now);
    const row = await prisma.request.update({
      where: { id: reqId },
      data: sideEffects,
    });
    return toRequestModel(row);
  }

  async function linkTorrent(reqId: number, torrentHash: string): Promise<Request> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.request.findUnique({ where: { id: reqId } });
      if (!existing) {
        throw new Error('Request not found');
      }

      const from = existing.status as RequestStatus;
      if (!canTransition(from, 'downloading')) {
        throw new InvalidTransitionError(`Cannot transition from ${from} to downloading`);
      }

      const sideEffects = resolveSideEffects('downloading', now);
      const row = await tx.request.update({
        where: { id: reqId },
        data: { ...sideEffects, torrent_hash: torrentHash },
      });
      return toRequestModel(row);
    });
  }

  function fulfillRequest(reqId: number): Promise<Request> {
    return transitionToStatus(reqId, 'fulfilled');
  }

  function downloadRequest(reqId: number): Promise<Request> {
    return transitionToStatus(reqId, 'downloading');
  }

  async function cancelRequest(reqId: number): Promise<void> {
    await prisma.request.delete({ where: { id: reqId } });
  }

  async function fulfillBySync(reqId: number, tx: Prisma.TransactionClient): Promise<void> {
    await tx.request.update({
      where: { id: reqId },
      data: {
        status: 'fulfilled',
        torrent_problem: null,
        resolved_at: now(),
      },
    });
  }

  async function flagTorrentProblem(reqId: number, problem: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.request.update({
      where: { id: reqId },
      data: { torrent_problem: problem },
    });
  }

  return {
    createRequest,
    createTvRequests,
    linkTorrent,
    transitionToStatus,
    fulfillRequest,
    downloadRequest,
    cancelRequest,
    fulfillBySync,
    flagTorrentProblem,
  };
}