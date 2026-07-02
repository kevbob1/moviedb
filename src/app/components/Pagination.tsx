import Link from 'next/link';
import { Button } from '@/components/ui/Button';

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
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
      {currentPage > 1 && (
        <Link href={buildUrl(currentPage - 1)}>
          <Button variant="secondary" size="md">Previous</Button>
        </Link>
      )}
      <span className="px-2 text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      {currentPage < totalPages && (
        <Link href={buildUrl(currentPage + 1)}>
          <Button variant="primary" size="md">Next</Button>
        </Link>
      )}
    </nav>
  );
}
