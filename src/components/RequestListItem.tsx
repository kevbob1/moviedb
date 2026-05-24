'use client';

import { getGenreNames } from '@/lib/genres';
import { cancelRequest } from '@/app/actions/request-actions';
import { Request } from './RequestGrid';
import { useState } from 'react';
import Image from 'next/image';

interface Props {
  request: Request;
  onRemoved?: () => void;
  jellyfinAvailable: boolean;
}

function getYear(date: string | undefined): string {
  return date?.split('-')[0] || '';
}

export function RequestListItem({ request, onRemoved, jellyfinAvailable }: Props) {
  const [deleted, setDeleted] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const handleCancel = async () => {
    setIsCanceling(true);
    try {
      await cancelRequest(request.id);
      setDeleted(true);
      onRemoved?.();
    } catch (error) {
      console.error('Failed to cancel request:', error);
    } finally {
      setIsCanceling(false);
    }
  };

  const handleMarkFulfilled = async () => {
    setIsCanceling(true);
    try {
      await cancelRequest(request.id);
      onRemoved?.();
    } catch (error) {
      console.error('Failed to mark as fulfilled:', error);
    } finally {
      setIsCanceling(false);
    }
  };

  if (deleted) {
    return null;
  }

  const posterUrl = request.poster_path
    ? `https://image.tmdb.org/t/p/w185${request.poster_path}`
    : null;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-sm shadow-sm p-3 flex gap-4 group">
      {posterUrl ? (
        <div className="w-16 h-24 flex-shrink-0 cursor-pointer" role="button" onClick={() => window.location.href = `/movies`}>
          <Image
            src={posterUrl}
            alt={request.title}
            width={64}
            height={96}
            className="w-full h-full object-cover rounded-sm hover:opacity-80 transition-opacity"
          />
        </div>
      ) : (
        <div className="w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded-sm flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {request.title}
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                {getYear(request.release_date)}
              </span>
            </h3>
            {request.genre_ids && request.genre_ids.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {getGenreNames(request.genre_ids).join(', ')}
              </p>
            )}
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            request.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
            request.status === 'downloading' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          }`}>
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </span>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          Requested by: <span className="font-medium text-gray-900 dark:text-white">{request.requested_by}</span>
          <span className="mx-1">•</span>
          {formatDate(request.requested_at)}
        </p>

        {request.overview && (
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
            {request.overview}
          </p>
        )}

        {request.status !== 'fulfilled' && (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={isCanceling}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded-sm hover:bg-red-700 disabled:opacity-50"
            >
              {isCanceling ? 'Cancelling...' : 'Cancel'}
            </button>
            <button
              onClick={handleMarkFulfilled}
              disabled={isCanceling}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Mark Fulfilled
            </button>
          </div>
        )}

        {jellyfinAvailable && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            Available in Jellyfin
          </span>
        )}
      </div>
    </div>
  );
}