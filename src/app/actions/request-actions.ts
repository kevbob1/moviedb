'use server';

import { defaultImportFlow, ImportResult } from '@/lib/import-flow';

import { revalidatePath } from 'next/cache';

import { requestService as lifecycleService, type RequestService } from '@/lib/request-lifecycle';

/**
 * The actions call four named lifecycle verbs — nothing else on the seam —
 * so they depend on that slice rather than the full `RequestService` union.
 */
const requestService: Pick<
  RequestService,
  'fulfillRequest' | 'downloadRequest' | 'cancelRequest' | 'linkTorrent'
> = lifecycleService;

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
  const result = await requestService.fulfillRequest(requestId);
  revalidatePath('/requests');
  return result;
}

export async function downloadRequest(requestId: number) {
  const result = await requestService.downloadRequest(requestId);
  revalidatePath('/requests');
  return result;
}

export async function cancelRequest(requestId: number) {
  await requestService.cancelRequest(requestId);
  revalidatePath('/requests');
  revalidatePath('/needs-match');
}

export async function linkTorrent(requestId: number, torrentHash: string) {
  const result = await requestService.linkTorrent(requestId, torrentHash);
  revalidatePath('/needs-match');
  revalidatePath('/');
  return result;
}
