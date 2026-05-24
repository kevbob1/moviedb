'use client';

interface ShowFulfilledCheckboxProps {
  defaultChecked: boolean;
  query: string;
}

export function ShowFulfilledCheckbox({
  defaultChecked,
  query,
}: ShowFulfilledCheckboxProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="w-4 h-4"
        onChange={(e) => {
          const params = new URLSearchParams();
          if (query) params.set('q', query);
          if (e.currentTarget.checked) params.set('showFulfilled', 'true');
          window.location.search = params.toString();
        }}
        name="showFulfilled"
      />
      <span className="text-gray-700 dark:text-gray-300">Show fulfilled</span>
    </label>
  );
}