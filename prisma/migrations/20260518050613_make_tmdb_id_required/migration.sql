/*
  Warnings:

  - Made the column `tmdb_id` on table `Movie` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Movie" ALTER COLUMN "tmdb_id" SET NOT NULL;
