-- DropIndex
DROP INDEX "requests_tmdb_id_key";

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "season_number" INTEGER;
