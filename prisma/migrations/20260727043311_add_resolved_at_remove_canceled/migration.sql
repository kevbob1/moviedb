-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "resolved_at" TIMESTAMP(3);

-- Backfill resolved_at for fulfilled requests (proxy: use requested_at)
UPDATE "requests" SET "resolved_at" = "requested_at" WHERE "status" = 'fulfilled';

-- Delete all canceled requests (cancellation is deletion per ADR-0006)
DELETE FROM "requests" WHERE "status" = 'canceled';
