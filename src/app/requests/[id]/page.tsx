import { prisma } from '@/lib/prisma';
import { areMoviesOnJellyfin } from '@/lib/jellyfin';
import { notFound } from 'next/navigation';
import RequestDetail from './RequestDetail';
import { toRequestModel } from '@/lib/request-utils';

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

  const typedRequest = toRequestModel(request);

  return (
    <main className="page-container">
      <h1 className="page-title">Request Details</h1>
      <RequestDetail request={typedRequest} jellyfinAvailable={jellyfinAvailability} />
    </main>
  );
}
