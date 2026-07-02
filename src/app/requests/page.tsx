import { prisma } from '@/lib/prisma';
import RequestList from '@/components/RequestList';
import { Pagination } from '@/app/components/Pagination';
import { ShowFulfilledSwitch } from '@/components/ShowFulfilledSwitch';
import { availabilityFor } from '@/lib/jellyfin';
import { toRequestModel } from '@/lib/request-utils';

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
  const jellyfinAvailabilityResult = await availabilityFor(tmdbIds);
  const jellyfinAvailability = Object.fromEntries(
    Object.entries(jellyfinAvailabilityResult).map(([k, v]) => [k, v.available])
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const typedRequests = requests.map(toRequestModel);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Requests
      </h1>

      <div className="mb-4">
        <ShowFulfilledSwitch
          defaultChecked={showFulfilled}
          query=""
        />
      </div>

      <RequestList
        requests={typedRequests}
        jellyfinAvailability={jellyfinAvailability}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        preserveParams={{ showFulfilled: params.showFulfilled || '' }}
      />
    </main>
  );
}
