import { MovieForm } from './MovieForm';

export default function NewMoviePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Add New Movie</h1>
        <MovieForm />
      </div>
    </div>
  );
}