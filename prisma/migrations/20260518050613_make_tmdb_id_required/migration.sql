-- Make tmdb_id required (NOT NULL)
ALTER TABLE "movies" ALTER COLUMN "tmdb_id" SET NOT NULL;