'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createMovie } from '@/app/actions/movie';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const movieSchema = z.object({
  tmdb_id: z.number().positive().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  release_date: z.number().optional(),
  poster_path: z.string().optional(),
  vote_average: z.number().min(0).max(10).optional(),
  genres: z.string().optional(),
});

type MovieFormData = z.infer<typeof movieSchema>;

export function MovieForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MovieFormData>({
    resolver: zodResolver(movieSchema),
  });

  const onSubmit = async (data: MovieFormData) => {
    setIsSubmitting(true);
    try {
      const movie = await createMovie(data);
      toast.success('Movie created successfully!');
      router.push(`/movies/${movie.id}`);
    } catch (error) {
      toast.error(`Failed to create movie: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title *
        </label>
        <input
          id="title"
          {...register('title')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          placeholder="Enter movie title"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          id="description"
          {...register('description')}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          placeholder="Enter movie description"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="release_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Release Year
          </label>
          <input
            id="release_date"
            type="number"
            {...register('release_date', { valueAsNumber: true })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
            placeholder="e.g., 2023"
          />
        </div>

        <div>
          <label htmlFor="vote_average" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Rating (0-10)
          </label>
          <input
            id="vote_average"
            type="number"
            step="0.1"
            min="0"
            max="10"
            {...register('vote_average', { valueAsNumber: true })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
            placeholder="0.0 - 10.0"
          />
        </div>
      </div>

      <div>
        <label htmlFor="poster_path" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Poster URL
        </label>
        <input
          id="poster_path"
          {...register('poster_path')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          placeholder="https://image.tmdb.org/..."
        />
      </div>

      <div>
        <label htmlFor="tmdb_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          TMDB ID *
        </label>
        <input
          id="tmdb_id"
          type="number"
          {...register('tmdb_id', { valueAsNumber: true })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          placeholder="Enter TMDB ID"
        />
        {errors.tmdb_id && <p className="mt-1 text-sm text-red-600">{errors.tmdb_id.message}</p>}
      </div>

      <div>
        <label htmlFor="genres" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Genres
        </label>
        <input
          id="genres"
          {...register('genres')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          placeholder="Comma-separated genres"
        />
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Movie'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}