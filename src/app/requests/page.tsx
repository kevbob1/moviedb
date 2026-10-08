import RequestList from '@/components/RequestList';
import { Pagination } from '@/app/components/Pagination';
import { ShowFulfilledSwitch } from '@/components/ShowFulfilledSwitch';
import { availabilityFor } from '@/lib/jellyfin';
import { requestService } from '@/lib/request-lifecycle';

export const dynamic = 'force-dynamic';

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; showFulfilled?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10) || 1;
  const includeResolved = params.showFulfilled === 'true';

  const { rows, totalPages } = await requestService.listRequests({ page, includeResolved });

  const tmdbIds = rows.map(r => r.tmdb_id).filter((id): id is number => id !== null && id !== undefined);
  const jellyfinAvailabilityResult = await availabilityFor(tmdbIds);
  const jellyfinAvailability = Object.fromEntries(
    Object.entries(jellyfinAvailabilityResult).map(([k, v]) => [k, v.available])
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Requests
      </h1>

      <div className="mb-4">
        <ShowFulfilledSwitch
          defaultChecked={includeResolved}
        />
      </div>

      <RequestList
        requests={rows}
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