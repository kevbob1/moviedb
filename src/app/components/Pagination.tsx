import Link from 'next/link';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  preserveParams?: Record<string, string>;
}

export function Pagination({ currentPage, totalPages, preserveParams = {} }: PaginationProps) {
  if (totalPages <= 1) return null;

  const buildUrl = (page: number) => {
    const params = new URLSearchParams(preserveParams);
    params.set('page', page.toString());
    return `?${params.toString()}`;
  };

  return (
    <nav className="mt-8 flex justify-center gap-4">
      {currentPage > 1 && (
        <Link
          href={buildUrl(currentPage - 1)}
          className="btn-primary btn-md"
        >
          Previous
        </Link>
      )}
      <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
        Page {currentPage} of {totalPages}
      </span>
      {currentPage < totalPages && (
        <Link
          href={buildUrl(currentPage + 1)}
          className="btn-primary btn-md"
        >
          Next
        </Link>
      )}
    </nav>
  );
}