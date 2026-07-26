import { prisma } from '@/lib/prisma';
import { registerJobType, JobHandler } from '@/lib/job-queue';
import { TransmissionAdapter, HttpTransmissionAdapter } from '@/lib/transmission/adapter';

const SEEDING_STATUS = 4;

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

      if (downloading.length === 0) return;

      const hashes = downloading
        .map(r => r.torrent_hash)
        .filter((h): h is string => h !== null);

      const torrents = await adapter.getTorrents(hashes);
      const torrentByHash = new Map(torrents.map(t => [t.hash, t]));

      await prisma.$transaction(async (tx) => {
        for (const req of downloading) {
          const hash = req.torrent_hash!;
          const torrent = torrentByHash.get(hash);

          if (!torrent) {
            await tx.request.update({
              where: { id: req.id },
              data: { torrent_problem: 'Torrent not found in Transmission' },
            });
            continue;
          }

          if (torrent.error) {
            await tx.request.update({
              where: { id: req.id },
              data: { torrent_problem: `Transmission error: ${torrent.error}` },
            });
            continue;
          }

          const isComplete = torrent.isFinished === true || torrent.status === SEEDING_STATUS;
          if (isComplete) {
            await tx.request.update({
              where: { id: req.id },
              data: { status: 'fulfilled', torrent_problem: null },
            });
          }
        }
      });
    },
  };
}

registerJobType('transmission_sync', createTransmissionSyncHandler({
  adapter: new HttpTransmissionAdapter(),
}));
