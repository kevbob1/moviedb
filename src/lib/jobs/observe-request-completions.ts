import type { RequestJobSync, SyncDecision } from '@/lib/request-lifecycle';
import type { TransmissionAdapter } from '@/lib/transmission/adapter';
import { TransmissionNotConfiguredError } from '@/lib/transmission/adapter';

const SEEDING_STATUS = 6;

export interface ObserveRequestCompletionsResult {
  scanned: number;
  torrents: number;
  fulfilled: number;
  problems: number;
}

interface ObserveRequestCompletionsDeps {
  adapter: TransmissionAdapter;
  requestService: Pick<RequestJobSync, 'downloadingRequestsWithHashes' | 'applySyncDecisions'>;
}

export async function observeRequestCompletions({
  adapter,
  requestService,
}: ObserveRequestCompletionsDeps): Promise<ObserveRequestCompletionsResult> {
  const downloading = await requestService.downloadingRequestsWithHashes();

  if (downloading.length === 0) {
    return { scanned: 0, torrents: 0, fulfilled: 0, problems: 0 };
  }

  let torrents: Awaited<ReturnType<TransmissionAdapter['getTorrents']>>;
  try {
    torrents = await adapter.getTorrents(
      downloading.map((request) => request.torrent_hash),
    );
  } catch (err) {
    if (err instanceof TransmissionNotConfiguredError) {
      return { scanned: 0, torrents: 0, fulfilled: 0, problems: 0 };
    }
    throw err;
  }
  const torrentByHash = new Map(torrents.map((torrent) => [torrent.hash, torrent]));
  const decisions: SyncDecision[] = [];

  for (const request of downloading) {
    const torrent = torrentByHash.get(request.torrent_hash);
    if (!torrent) {
      decisions.push({
        requestId: request.id,
        outcome: 'problem',
        problem: 'Torrent not found in Transmission',
      });
      continue;
    }
    if (torrent.error) {
      decisions.push({
        requestId: request.id,
        outcome: 'problem',
        problem: `Transmission error: ${torrent.error}`,
      });
      continue;
    }
    if (torrent.isFinished === true || torrent.status === SEEDING_STATUS) {
      decisions.push({ requestId: request.id, outcome: 'fulfilled' });
    }
  }

  if (decisions.length > 0) {
    await requestService.applySyncDecisions(decisions);
  }

  const fulfilled = decisions.filter((decision) => decision.outcome === 'fulfilled').length;
  return {
    scanned: downloading.length,
    torrents: torrents.length,
    fulfilled,
    problems: decisions.length - fulfilled,
  };
}
