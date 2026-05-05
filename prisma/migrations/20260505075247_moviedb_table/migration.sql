-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "description" TEXT,
ADD COLUMN     "genres" TEXT,
ADD COLUMN     "poster_path" TEXT,
ADD COLUMN     "vote_average" DOUBLE PRECISION,
ALTER COLUMN "tmdb_id" DROP NOT NULL;
