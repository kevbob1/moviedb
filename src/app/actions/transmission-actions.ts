'use server';

import { revalidatePath } from 'next/cache';

import { enqueue, type EnqueueResult } from '@/lib/jobs';

// A `'use server'` module may only export server actions, so the queue verb is
// bound through this action rather than re-exported.
export async function syncTransmission(): Promise<EnqueueResult> {
  const enqueued = await enqueue('transmission_sync', { trigger: 'manual' });
  revalidatePath('/needs-match');
  return enqueued;
}
