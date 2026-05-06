import { prisma } from '@/lib/prisma';
import { MovieGrid } from '../components/MovieGrid';
import { SearchInput } from '../components/SearchInput';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 12;

export default async function MoviesPage({
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

  const [movies, total] = await Promise.all([
    prisma.movie.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.movie.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Movies
      </h1>

      <div className="mb-6">
        <SearchInput defaultValue={query} />
      </div>

      <MovieGrid movies={movies} />

      <Pagination currentPage={page} totalPages={totalPages} />
    </main>
  );
}