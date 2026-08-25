import type { PrismaClient } from '@/generated/prisma/client';
import type { RequestService } from '@/lib/request-lifecycle';
import type { TransmissionAdapter } from '@/lib/transmission/adapter';

const SEEDING_STATUS = 6;

export interface ObserveRequestCompletionsResult {
  scanned: number;
  torrents: number;
  fulfilled: number;
  problems: number;
}

interface ObserveRequestCompletionsDeps {
  adapter: TransmissionAdapter;
  prisma: PrismaClient;
  requestService: Pick<RequestService, 'fulfillBySync' | 'flagTorrentProblem'>;
}

export async function observeRequestCompletions({
  adapter,
  prisma,
  requestService,
}: ObserveRequestCompletionsDeps): Promise<ObserveRequestCompletionsResult> {
  const downloading = await prisma.request.findMany({
    where: { status: 'downloading', torrent_hash: { not: null } },
    select: { id: true, torrent_hash: true },
  });

  if (downloading.length === 0) {
    return { scanned: 0, torrents: 0, fulfilled: 0, problems: 0 };
  }

  const hashes = downloading
    .map((request) => request.torrent_hash)
    .filter((hash): hash is string => hash !== null);
  const torrents = await adapter.getTorrents(hashes);
  const torrentByHash = new Map(torrents.map((torrent) => [torrent.hash, torrent]));
  let fulfilled = 0;
  let problems = 0;

  await prisma.$transaction(async (tx) => {
    for (const request of downloading) {
      const torrent = torrentByHash.get(request.torrent_hash!);
      if (!torrent) {
        await requestService.flagTorrentProblem(request.id, 'Torrent not found in Transmission', tx);
        problems++;
        continue;
      }
      if (torrent.error) {
        await requestService.flagTorrentProblem(request.id, `Transmission error: ${torrent.error}`, tx);
        problems++;
        continue;
      }
      if (torrent.isFinished === true || torrent.status === SEEDING_STATUS) {
        await requestService.fulfillBySync(request.id, tx);
        fulfilled++;
      }
    }
  });

  return { scanned: downloading.length, torrents: torrents.length, fulfilled, problems };
}
