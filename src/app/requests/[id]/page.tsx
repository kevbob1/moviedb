import { isOnJellyfin } from '@/lib/jellyfin';
import { notFound } from 'next/navigation';
import RequestDetail from './RequestDetail';
import { requestService } from '@/lib/request-lifecycle';

export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const requestId = parseInt(id, 10);

  if (isNaN(requestId)) {
    notFound();
  }

  const request = await requestService.requestById(requestId);

  if (!request) {
    notFound();
  }

  const tmdbId = request.tmdb_id;
  let jellyfinAvailability = false;
  if (tmdbId !== undefined) {
    const result = await isOnJellyfin(tmdbId);
    jellyfinAvailability = result.available;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Request Details</h1>
      <RequestDetail request={request} jellyfinAvailable={jellyfinAvailability} />
    </main>
  );
}