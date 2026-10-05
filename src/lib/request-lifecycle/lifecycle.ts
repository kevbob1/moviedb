import { Prisma, PrismaClient } from '@/generated/prisma/client';

import {
  canTransition,
  InvalidTransitionError,
  RequestStatus,
  resolveSideEffects,
} from './fsm';
import { Request, toRequestModel } from './projection';

/**
 * Shared client shape used by the lifecycle transition helper: both the root
 * `PrismaClient` and the transaction client handed to `$transaction(fn)` expose
 * the same `request.findUnique` / `request.update` surface, so a helper can
 * serve both `fulfillRequest` / `downloadRequest` (which write directly) and
 * `linkTorrent` (which writes inside a transaction for atomicity with future
 * companion writes).
 */
type TransitionClient = PrismaClient | Prisma.TransactionClient;

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
   *   write is atomic with the transition; this is the same canTransition +
   *   resolveSideEffects pipeline, with `torrent_hash` spread into the
   *   side-effects so the FSM reconciliation is uniform across verbs.
   *
   * `transitionToStatus` is deliberately NOT exposed on `RequestLifecycle`:
   * callers must use a named verb so intent is encoded in the call site.
   */
  async function transitionToStatus(
    client: TransitionClient,
    reqId: number,
    target: RequestStatus,
    extras: Record<string, unknown> = {},
  ): Promise<Request> {
    const existing = await client.request.findUnique({ where: { id: reqId } });
    if (!existing) {
      throw new Error('Request not found');
    }

    const from = existing.status as RequestStatus;
    if (!canTransition(from, target)) {
      throw new InvalidTransitionError(`Cannot transition from ${from} to ${target}`);
    }

    const sideEffects = resolveSideEffects(target, now);
    const row = await client.request.update({
      where: { id: reqId },
      data: { ...sideEffects, ...extras },
    });
    return toRequestModel(row);
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