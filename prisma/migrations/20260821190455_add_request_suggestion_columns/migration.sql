-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "suggestion_computed_at" TIMESTAMP(3),
ADD COLUMN     "suggestion_hash" TEXT,
ADD COLUMN     "suggestion_score" DOUBLE PRECISION;
