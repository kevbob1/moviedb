import { PrismaClient } from '@/generated/prisma/client';

import { InvalidTransitionError, RequestStatus } from './fsm';
import { Request } from './projection';
import { applyTransition, TransitionClient, TransitionExtras } from './transitions';

export interface RequestLifecycleDeps {
  prisma: PrismaClient;
  now: () => Date;
}

export interface RequestLifecycle {
  linkTorrent(reqId: number, torrentHash: string): Promise<Request>;
  fulfillRequest(reqId: number): Promise<Request>;
  downloadRequest(reqId: number): Promise<Request>;
  cancelRequest(reqId: number): Promise<void>;
}

export function createRequestLifecycle({
  prisma,
  now,
}: RequestLifecycleDeps): RequestLifecycle {
  /**
   * Internal FSM-aware transition helper. Used by every lifecycle verb:
   * - `fulfillRequest` and `downloadRequest` call it directly via `prisma`.
   * - `linkTorrent` calls it inside `prisma.$transaction` so the torrent_hash
   *   write is atomic with the transition.
   *
   * It delegates to `applyTransition`, the module's single write path, and maps
   * what that reports to this call site's error modes: a missing Request throws
   * `Request not found`, a disallowed transition throws `InvalidTransitionError`.
   *
   * `transitionToStatus` is deliberately NOT exposed on `RequestLifecycle`:
   * callers must use a named verb so intent is encoded in the call site.
   */
  async function transitionToStatus(
    client: TransitionClient,
    reqId: number,
    target: RequestStatus,
    extras: TransitionExtras = {},
  ): Promise<Request> {
    const outcome = await applyTransition(client, reqId, target, now, extras);
    if (!outcome.ok) {
      if (outcome.skipped === 'not_found') {
        throw new Error('Request not found');
      }
      throw new InvalidTransitionError(`Cannot transition from ${outcome.from} to ${target}`);
    }
    return outcome.request;
  }

  function fulfillRequest(reqId: number): Promise<Request> {
    return transitionToStatus(prisma, reqId, 'fulfilled');
  }

  function downloadRequest(reqId: number): Promise<Request> {
    return transitionToStatus(prisma, reqId, 'downloading');
  }

  function linkTorrent(reqId: number, torrentHash: string): Promise<Request> {
    return prisma.$transaction(async (tx) =>
      transitionToStatus(tx, reqId, 'downloading', { torrent_hash: torrentHash }),
    );
  }

  async function cancelRequest(reqId: number): Promise<void> {
    await prisma.request.delete({ where: { id: reqId } });
  }

  return {
    linkTorrent,
    fulfillRequest,
    downloadRequest,
    cancelRequest,
  };
}