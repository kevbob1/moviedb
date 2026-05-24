'use client';

import { useState } from 'react';

interface Props {
  onSubmit: (requestedBy: string) => void;
  onCancel: () => void;
  isVisible: boolean;
}

export function RequestForm({ onSubmit, onCancel, isVisible }: Props) {
  const [requestedBy, setRequestedBy] = useState('');

  if (!isVisible) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestedBy.trim()) {
      onSubmit(requestedBy.trim());
      setRequestedBy('');
    }
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-sm p-4 mt-3">
      <form onSubmit={handleSubmit}>
        <label htmlFor="requestedBy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Requested by (your name):
        </label>
        <input
          id="requestedBy"
          type="text"
          value={requestedBy}
          onChange={(e) => setRequestedBy(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Your name"
          required
        />

        <div className="flex gap-2 mt-3">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-sm hover:bg-blue-700"
          >
            Submit Request
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-sm hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
