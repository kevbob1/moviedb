import { NextResponse } from 'next/server';

/**
 * Returns a 401 NextResponse when CRON_SECRET is configured and the
 * Authorization header does not match; otherwise null (request proceeds).
 * Fail-open when CRON_SECRET is unset — local dev posture, keep it.
 */
export function requireCronAuth(headers: Headers): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return null;
  if (headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
