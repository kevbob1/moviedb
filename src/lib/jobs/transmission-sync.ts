import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requestService } from '@/lib/request-lifecycle';
import { registerJobType, JobHandler } from '@/lib/job-queue';
import { TransmissionAdapter, HttpTransmissionAdapter } from '@/lib/transmission/adapter';
import { matchSuggestions } from '@/lib/matcher';
import { parseTorrentTitle } from '@viren070/parse-torrent-title';

const SEEDING_STATUS = 6;
const JOB_TYPE = 'transmission_sync';

export async function enqueueTransmissionSync(): Promise<boolean> {
  const outstanding = await prisma.job.findFirst({
    where: { type: JOB_TYPE, status: { in: ['pending', 'processing'] } },
    select: { id: true },
  });

  if (outstanding) {
    logger.debug({ jobId: outstanding.id }, 'transmission_sync already outstanding, skipping enqueue');
    return false;
  }

  await prisma.job.create({ data: { type: JOB_TYPE, payload: {} } });
  logger.info('transmission_sync job enqueued');
  return true;
}

interface SyncHandlerOptions {
  adapter: TransmissionAdapter;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function createTransmissionSyncHandler({ adapter }: SyncHandlerOptions): JobHandler<unknown> {
  return {
    handle: async () => {
      const downloading = await prisma.request.findMany({
        where: {
          status: 'downloading',
          torrent_hash: { not: null },
        },
        select: { id: true, torrent_hash: true },
      });

      if (downloading.length > 0) {
        const hashes = downloading
          .map((r) => r.torrent_hash)
          .filter((h): h is string => h !== null);

        const torrents = await adapter.getTorrents(hashes);
        const torrentByHash = new Map(torrents.map((t) => [t.hash, t]));

        let fulfilled = 0;
        let problems = 0;

        await prisma.$transaction(async (tx) => {
          for (const req of downloading) {
            const hash = req.torrent_hash!;
            const torrent = torrentByHash.get(hash);

            if (!torrent) {
              await requestService.flagTorrentProblem(req.id, 'Torrent not found in Transmission', tx);
              problems++;
              continue;
            }

            if (torrent.error) {
              await requestService.flagTorrentProblem(req.id, `Transmission error: ${torrent.error}`, tx);
              problems++;
              continue;
            }

            const isComplete = torrent.isFinished === true || torrent.status === SEEDING_STATUS;
            if (isComplete) {
              await requestService.fulfillBySync(req.id, tx);
              fulfilled++;
            }
          }
        });

        logger.info(
          { scanned: downloading.length, torrents: torrents.length, fulfilled, problems },
          'transmission_sync completed'
        );
      } else {
        logger.debug('transmission_sync: no downloading requests with torrent_hash');
      }

      const now = new Date();
      const pendingRequests = await prisma.request.findMany({
        where: {
          status: 'pending',
          torrent_hash: null,
          OR: [
            { suggestion_computed_at: { lt: new Date(now.getTime() - 60_000) } },
            { suggestion_computed_at: { equals: null } },
          ],
        },
        select: {
          id: true,
          title: true,
          media_type: true,
          release_date: true,
          season_number: true,
        },
      });

      if (pendingRequests.length === 0) {
        logger.debug('transmission_sync: no pending requests need suggestions');
        return;
      }

      const allTorrents = await adapter.getAll();

      let parserFailures = 0;
      for (const torrent of allTorrents) {
        for (const source of [torrent.name, ...(torrent.files ?? [])]) {
          if (!source) continue;
          const parsed = parseTorrentTitle(source);
          if (!parsed.title) {
            parserFailures++;
          }
        }
      }

      const suggestions = matchSuggestions(pendingRequests, allTorrents);

      let withSuggestion = 0;
      const scores: number[] = [];

      await prisma.$transaction(async (tx) => {
        for (const request of pendingRequests) {
          try {
            const suggestion = suggestions.get(request.id) ?? null;
            if (suggestion) {
              withSuggestion++;
              scores.push(suggestion.score);
              await tx.request.update({
                where: { id: request.id },
                data: {
                  suggestion_hash: suggestion.hash,
                  suggestion_score: suggestion.score,
                  suggestion_computed_at: now,
                },
              });
            } else {
              await tx.request.update({
                where: { id: request.id },
                data: {
                  suggestion_hash: null,
                  suggestion_score: null,
                  suggestion_computed_at: now,
                },
              });
            }
          } catch (err) {
            logger.error(
              { err, requestId: request.id },
              'transmission_sync: failed to persist suggestion'
            );
          }
        }
      });

      const medianScore = median(scores);

      logger.info(
        { scanned: pendingRequests.length, suggestions: withSuggestion, medianScore, parserFailures },
        'transmission_sync suggestions computed'
      );
    },
  };
}

registerJobType('transmission_sync', createTransmissionSyncHandler({
  adapter: new HttpTransmissionAdapter(),
}));