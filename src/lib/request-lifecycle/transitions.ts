import { Prisma, PrismaClient } from '@/generated/prisma/client';

import { canTransition, RequestStatus, resolveSideEffects } from './fsm';
import { Request, toRequestModel } from './projection';

/**
 * Shared client shape: both the root `PrismaClient` and the transaction client
 * handed to `$transaction(fn)` expose the same `request.findUnique` /
 * `request.update` surface, so one write path serves both the named verbs
 * (which write directly) and the batch verbs (which write inside a
 * transaction).
 */
export type TransitionClient = PrismaClient | Prisma.TransactionClient;

/**
 * Why a target Request was left alone. `invalid_transition` carries the status
 * the row is actually in, so the caller can describe it without re-reading.
 */
export type TransitionOutcome =
  | { ok: true; request: Request }
  | { ok: false; skipped: 'not_found' }
  | { ok: false; skipped: 'invalid_transition'; from: RequestStatus };

/**
 * The module's single FSM-aware write path. Every transition — a named verb or
 * a batch verb — resolves its side effects through here, so the set of columns
 * a transition writes has exactly one definition.
 *
 * A skip is not an error: the caller decides what one means. The named verbs
 * throw; the batch verbs count it and carry on.
 *
 * `extras` is written alongside the resolved side effects (currently only
 * `torrent_hash`, from `linkTorrent` and `autoLinkBatch`).
 */
export async function applyTransition(
  client: TransitionClient,
  reqId: number,
  target: RequestStatus,
  extras: Record<string, unknown>,
  now: () => Date,
): Promise<TransitionOutcome> {
  const existing = await client.request.findUnique({ where: { id: reqId } });
  if (!existing) {
    return { ok: false, skipped: 'not_found' };
  }

  const from = existing.status as RequestStatus;
  if (!canTransition(from, target)) {
    return { ok: false, skipped: 'invalid_transition', from };
  }

  const row = await client.request.update({
    where: { id: reqId },
    data: { ...resolveSideEffects(target, now), ...extras },
  });

  return { ok: true, request: toRequestModel(row) };
}
