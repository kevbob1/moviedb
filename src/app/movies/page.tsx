import { prisma } from '@/lib/prisma';
import { RequestGrid } from '@/components/RequestGrid';
import { SearchInput } from '@/app/components/SearchInput';
import { Pagination } from '@/app/components/Pagination';
import { areMoviesOnJellyfin } from '@/lib/jellyfin';

type RequestStatus = 'pending' | 'downloading' | 'fulfilled';

const PAGE_SIZE = 12;

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || '';
  const page = parseInt(params.page || '1', 10);
  const skip = (page - 1) * PAGE_SIZE;

  const where = query
    ? { title: { contains: query, mode: 'insensitive' as const } }
    : {};

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
        status: r.status as RequestStatus
      }));

      return (
        <main className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
            Requests
          </h1>

          <div className="mb-6">
            <SearchInput defaultValue={query} />
          </div>

          <RequestGrid
            requests={typedRequests}
            jellyfinAvailability={Object.fromEntries(jellyfinAvailability)}
          />

      <Pagination currentPage={page} totalPages={totalPages} />
    </main>
  );
}