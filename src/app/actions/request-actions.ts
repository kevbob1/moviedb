'use server';

import { defaultImportFlow, ImportResult } from '@/lib/import-flow';

import { revalidatePath } from 'next/cache';

import { requestService } from '@/lib/request-lifecycle';

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
