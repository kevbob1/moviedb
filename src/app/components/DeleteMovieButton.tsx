'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { deleteMovie } from '@/app/actions/movie';

interface DeleteMovieButtonProps {
  movieId: number;
}

export function DeleteMovieButton({ movieId }: DeleteMovieButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this movie? This action cannot be undone.'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteMovie(movieId);
      toast.success('Movie deleted successfully!');
      router.push('/movies');
    } catch (error) {
      toast.error(`Failed to delete movie: ${(error as Error).message}`);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="mt-6 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isDeleting ? 'Deleting...' : 'Delete Movie'}
    </button>
  );
}
