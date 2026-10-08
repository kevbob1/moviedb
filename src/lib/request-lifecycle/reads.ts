import { PrismaClient } from '@/generated/prisma/client';

import { Request, toRequestModel } from './projection';

/**
 * Rows returned per page by the operator-facing list read. Kept inside the
 * module so callers ask for a page number and never do `skip`/`take`
 * arithmetic themselves.
 */
export const REQUESTS_PER_PAGE = 12;

export interface RequestReadsDeps {
  prisma: PrismaClient;
}

export interface RequestReads {
  /**
   * A page of Requests, newest first, with the total row count and derived
   * page count so callers can render pagination without knowing the page-size
   * arithmetic. `includeResolved` (ADR-0006: a Request is *resolved* once it
   * enters the terminal state) defaults to false, so the default answer is the
   * operator's active queue — `pending` + `downloading`.
   */
  listRequests(options: {
    page: number;
    includeResolved?: boolean;
  }): Promise<{ rows: Request[]; total: number; totalPages: number }>;

  /** A single Request by id, or `null` when no row exists. */
  requestById(id: number): Promise<Request | null>;
}

export function createRequestReads({ prisma }: RequestReadsDeps): RequestReads {
  async function listRequests({
    page,
    includeResolved = false,
  }: {
    page: number;
    includeResolved?: boolean;
  }): Promise<{ rows: Request[]; total: number; totalPages: number }> {
    const where = includeResolved
      ? undefined
      : { status: { notIn: ['fulfilled'] } };

    const skip = (page - 1) * REQUESTS_PER_PAGE;

    const [rows, total] = await Promise.all([
      prisma.request.findMany({
        where,
        orderBy: { requested_at: 'desc' },
        skip,
        take: REQUESTS_PER_PAGE,
      }),
      prisma.request.count({ where }),
    ]);

    return {
      rows: rows.map(toRequestModel),
      total,
      totalPages: Math.ceil(total / REQUESTS_PER_PAGE),
    };
  }

  async function requestById(id: number): Promise<Request | null> {
    const row = await prisma.request.findUnique({ where: { id } });
    return row ? toRequestModel(row) : null;
  }

  return {
    listRequests,
    requestById,
  };
}