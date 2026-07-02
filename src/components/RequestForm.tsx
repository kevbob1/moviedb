'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

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

  if (!isVisible) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = requestedBy.trim();
    if (!name) return;
    localStorage.setItem(STORAGE_KEY, name);
    setSubmitting(true);
    try {
      await onSubmit(name);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-muted-foreground">
        <Spinner size="sm" />
        Submitting…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Input
        label="Your name"
        value={requestedBy}
        onChange={(e) => setRequestedBy(e.target.value)}
        placeholder="Your name"
        required
        className="sm:w-56"
      />
      <div className="flex gap-2">
        <Button type="submit" size="md">Submit</Button>
        <Button type="button" size="md" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
