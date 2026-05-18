import { TMDBSearch } from './TMDBSearch';

export default function ImportMoviePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Import Movie from TMDB</h1>
        <TMDBSearch />
      </div>
    </div>
  );
}