-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "genre_ids" INTEGER[] NOT NULL DEFAULT '{}',
ADD COLUMN     "overview" TEXT,
ADD COLUMN     "release_date" TEXT;
