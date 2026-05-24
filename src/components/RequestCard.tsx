'use client';

import { useState } from 'react';
import Image from 'next/image';
import { JellyfinBadge } from './JellyfinBadge';
import { fulfillRequest } from '@/app/actions/request-actions';

interface Request {
  id: number;
  title: string;
  tmdb_id: number | null;
  poster_path: string | null;
  requested_at: Date;
  requested_by: string;
  status: 'pending' | 'downloading' | 'fulfilled';
  media_type: string;
}

interface Props {
  request: Request;
  onJellyfin: (tmdbId: number | null) => boolean;
}

export function RequestCard({ request, onJellyfin }: Props) {
  const [isFulfilling, setIsFulfilling] = useState(false);

  const posterUrl = request.poster_path
    ? `https://image.tmdb.org/t/p/w342${request.poster_path}`
    : null;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    downloading: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    fulfilled: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  };

  const jellyfinAvailable = onJellyfin(request.tmdb_id);

  const handleFulfill = async (formData: FormData) => {
    setIsFulfilling(true);
    try {
      await fulfillRequest(request.id);
    } catch (error) {
      console.error('Failed to fulfill request:', error);
    } finally {
      setIsFulfilling(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-sm shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex gap-4">
          {posterUrl ? (
            <div className="flex-shrink-0">
              <Image
                src={posterUrl}
                alt={request.title}
                width={120}
                height={180}
                className="rounded-sm"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-[120px] h-[180px] bg-gray-200 dark:bg-gray-700 rounded-sm flex items-center justify-center">
              No Poster
            </div>
          )}

          <div className="flex-grow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {request.title}
            </h3>

            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${statusColors[request.status]}`}>
                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </span>

              {jellyfinAvailable && (
                <JellyfinBadge available={true} />
              )}
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              <p>Requested by: <span className="font-medium text-gray-900 dark:text-white">{request.requested_by}</span></p>
              <p>On: {formatDate(request.requested_at)}</p>
            </div>

            {request.status !== 'fulfilled' && (
              <form action={handleFulfill}>
                <button
                  type="submit"
                  disabled={isFulfilling}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isFulfilling ? 'Marking...' : 'Mark Fulfilled'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
