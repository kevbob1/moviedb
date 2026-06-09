'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'moviedb-requestor-name';

interface Props {
  onSubmit: (requestedBy: string) => Promise<void>;
  onCancel: () => void;
  isVisible: boolean;
}

export function RequestForm({ onSubmit, onCancel, isVisible }: Props) {
  const [requestedBy, setRequestedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestedBy.trim()) {
      localStorage.setItem(STORAGE_KEY, requestedBy.trim());
      setSubmitting(true);
      try {
        await onSubmit(requestedBy.trim());
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (submitting) {
    return (
      <div className="alert-request flex items-center gap-2">
        <span className="spinner" />
        <span className="text-sm text-muted-foreground">Submitting...</span>
      </div>
    );
  }

  return (
    <div className="alert-request">
      <form onSubmit={handleSubmit}>
        <label htmlFor="requestedBy" className="block text-sm font-medium text-muted-foreground mb-2">
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
            className="btn-primary btn-md"
          >
            Submit Request
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary btn-md"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
