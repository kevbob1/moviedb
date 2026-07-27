import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { registerJobType, JobHandler } from '@/lib/job-queue';
import { TransmissionAdapter, HttpTransmissionAdapter } from '@/lib/transmission/adapter';

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

      if (downloading.length === 0) {
        logger.debug('transmission_sync: no downloading requests with torrent_hash');
        return;
      }

      const hashes = downloading
        .map(r => r.torrent_hash)
        .filter((h): h is string => h !== null);

      const torrents = await adapter.getTorrents(hashes);
      const torrentByHash = new Map(torrents.map(t => [t.hash, t]));

      let fulfilled = 0;
      let problems = 0;

      await prisma.$transaction(async (tx) => {
        for (const req of downloading) {
          const hash = req.torrent_hash!;
          const torrent = torrentByHash.get(hash);

          if (!torrent) {
            await tx.request.update({
              where: { id: req.id },
              data: { torrent_problem: 'Torrent not found in Transmission' },
            });
            problems++;
            continue;
          }

          if (torrent.error) {
            await tx.request.update({
              where: { id: req.id },
              data: { torrent_problem: `Transmission error: ${torrent.error}` },
            });
            problems++;
            continue;
          }

          const isComplete = torrent.isFinished === true || torrent.status === SEEDING_STATUS;
          if (isComplete) {
            await tx.request.update({
              where: { id: req.id },
              data: { status: 'fulfilled', torrent_problem: null, resolved_at: new Date() },
            });
            fulfilled++;
          }
        }
      });

      logger.info(
        { scanned: downloading.length, torrents: torrents.length, fulfilled, problems },
        'transmission_sync completed'
      );
    },
  };
}

registerJobType('transmission_sync', createTransmissionSyncHandler({
  adapter: new HttpTransmissionAdapter(),
}));
