'use server';

import { defaultImportFlow, ImportResult } from '@/lib/import-flow';

import { revalidatePath } from 'next/cache';

import { requestService, type RequestActionsPort } from '@/lib/request-lifecycle';

/**
 * The action seam is the four named lifecycle verbs and nothing else. A
 * `'use server'` module can only export server actions, so the port is bound
 * once at module scope with the singleton default rather than taken as a
 * per-call argument.
 */
const requests: RequestActionsPort = requestService;

export async function requestImport(
  result: ImportResult,
  seasonNumber: number | 'all',
  requestedBy: string,
): Promise<ImportResult> {
  const refreshed = await defaultImportFlow.requestImport(result, seasonNumber, requestedBy);
  revalidatePath('/requests');
  revalidatePath('/needs-match');
  return refreshed;
}

export async function fulfillRequest(requestId: number) {
  const result = await requests.fulfillRequest(requestId);
  revalidatePath('/requests');
  return result;
}

export async function downloadRequest(requestId: number) {
  const result = await requests.downloadRequest(requestId);
  revalidatePath('/requests');
  return result;
}

export async function cancelRequest(requestId: number) {
  await requests.cancelRequest(requestId);
  revalidatePath('/requests');
  revalidatePath('/needs-match');
}

export async function linkTorrent(requestId: number, torrentHash: string) {
  const result = await requests.linkTorrent(requestId, torrentHash);
  revalidatePath('/needs-match');
  revalidatePath('/');
  return result;
}
