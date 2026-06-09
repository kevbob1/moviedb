import { prisma } from '@/lib/prisma';
import { areMoviesOnJellyfin } from '@/lib/jellyfin';
import { notFound } from 'next/navigation';
import RequestDetail from './RequestDetail';

import type { RequestStatus } from '@/lib/request-fsm';

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

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    notFound();
  }

  const tmdbId = request.tmdb_id;
  let jellyfinAvailability = false;
  if (tmdbId !== null) {
    const availabilityMap = await areMoviesOnJellyfin([tmdbId]);
    jellyfinAvailability = availabilityMap.get(tmdbId) ?? false;
  }

  const typedRequest = {
    ...request,
    tmdb_id: request.tmdb_id ?? undefined,
    poster_path: request.poster_path ?? undefined,
    overview: request.overview ?? undefined,
    release_date: request.release_date ?? undefined,
    requested_at: request.requested_at.toISOString(),
    status: request.status as RequestStatus,
    season_number: request.season_number ?? undefined,
    media_type: request.media_type ?? undefined,
  };

  return (
    <main className="page-container">
      <h1 className="page-title">Request Details</h1>
      <RequestDetail request={typedRequest} jellyfinAvailable={jellyfinAvailability} />
    </main>
  );
}
