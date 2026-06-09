import { prisma } from '@/lib/prisma';
import RequestList from '@/components/RequestList';
import { Pagination } from '@/app/components/Pagination';
import { ShowFulfilledCheckbox } from '@/components/ShowFulfilledCheckbox';
import { areMoviesOnJellyfin } from '@/lib/jellyfin';

type RequestStatus = 'pending' | 'downloading' | 'fulfilled';

const PAGE_SIZE = 12;

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; showFulfilled?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const skip = (page - 1) * PAGE_SIZE;
  const showFulfilled = params.showFulfilled === 'true';

  const where = {
    status: showFulfilled
      ? { notIn: ['canceled'] }
      : { notIn: ['fulfilled', 'canceled'] },
  };

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { requested_at: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.request.count({ where }),
  ]);

  const tmdbIds = requests.map(r => r.tmdb_id).filter((id): id is number => id !== null);
  const jellyfinAvailability = await areMoviesOnJellyfin(tmdbIds);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const typedRequests = requests.map(r => ({
    ...r,
    tmdb_id: r.tmdb_id ?? undefined,
    poster_path: r.poster_path ?? undefined,
    overview: r.overview ?? undefined,
    release_date: r.release_date ?? undefined,
    requested_at: r.requested_at.toISOString(),
    status: r.status as RequestStatus,
    season_number: r.season_number ?? undefined,
    media_type: r.media_type ?? undefined,
  }));

  return (
    <main className="page-container">
      <h1 className="page-title">
        Requests
      </h1>

      <div className="mb-4">
        <ShowFulfilledCheckbox
          defaultChecked={showFulfilled}
          query=""
        />
      </div>

      <RequestList
        requests={typedRequests}
        jellyfinAvailability={Object.fromEntries(jellyfinAvailability)}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        preserveParams={{ showFulfilled: params.showFulfilled || '' }}
      />
    </main>
  );
}
