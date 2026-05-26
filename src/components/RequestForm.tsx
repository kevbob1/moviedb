'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'moviedb-requestor-name';

interface Props {
  onSubmit: (requestedBy: string) => void;
  onCancel: () => void;
  isVisible: boolean;
}

export function RequestForm({ onSubmit, onCancel, isVisible }: Props) {
  const [requestedBy, setRequestedBy] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount
      setRequestedBy(stored);
    }
  }, []);

  if (!isVisible) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestedBy.trim()) {
      localStorage.setItem(STORAGE_KEY, requestedBy.trim());
      onSubmit(requestedBy.trim());
      setRequestedBy('');
    }
  };

  return (
    <div className="alert-request">
      <form onSubmit={handleSubmit}>
        <label htmlFor="requestedBy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Requested by (your name):
        </label>
        <input
          id="requestedBy"
          type="text"
          value={requestedBy}
          onChange={(e) => setRequestedBy(e.target.value)}
          className="input w-full"
          placeholder="Your name"
          required
        />

        <div className="form-row mt-3">
          <button
            type="submit"
            className="btn-primary btn-md btn-responsive"
          >
            Submit Request
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary btn-md btn-responsive"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
