'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

export function SearchInput({ defaultValue = '' }: { defaultValue?: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const [value, setValue] = useState(defaultValue);

  const handleSearch = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams);
      if (term) {
        params.set('q', term);
      } else {
        params.delete('q');
      }
      params.delete('page');
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, replace]
  );

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        handleSearch(e.target.value);
      }}
      placeholder="Search movies..."
      className="w-full md:w-96 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
    />
  );
}