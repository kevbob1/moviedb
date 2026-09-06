'use server';

import { revalidatePath } from 'next/cache';

import { enqueueTransmissionSync } from '@/lib/jobs/transmission-sync';

export async function syncTransmission() {
  const result = await enqueueTransmissionSync({ trigger: 'manual' });
  revalidatePath('/needs-match');
  return result;
}
