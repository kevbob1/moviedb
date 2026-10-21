-- Database-level dedup guard for singleton job types (currently transmission_sync).
--
-- enqueueTransmissionSync() keeps a findFirst() fast path, but two concurrent
-- callers could both observe "nothing outstanding" and both insert. This partial
-- unique index makes the second insert fail atomically; the enqueue path catches
-- the unique violation (P2002) and reports queued: false.
--
-- The predicate is scoped to transmission_sync and to live statuses only:
--   * other job types (request_notification, tv_series_request_notification)
--     legitimately allow several outstanding rows at once;
--   * completed/failed rows never block a future enqueue.
--
-- Collapse any pre-existing duplicates before adding the index: keep the oldest
-- live row per type, mark the rest completed so history is preserved.
UPDATE "jobs" AS doomed
SET "status" = 'completed',
    "completed_at" = NOW(),
    "error" = COALESCE(doomed."error", 'superseded: duplicate live singleton job')
WHERE doomed."type" = 'transmission_sync'
  AND doomed."status" IN ('pending', 'processing')
  AND doomed."id" <> (
    SELECT keeper."id"
    FROM "jobs" AS keeper
    WHERE keeper."type" = doomed."type"
      AND keeper."status" IN ('pending', 'processing')
    ORDER BY keeper."created_at" ASC, keeper."id" ASC
    LIMIT 1
  );

CREATE UNIQUE INDEX "jobs_singleton_live_type_key"
  ON "jobs" ("type")
  WHERE "type" = 'transmission_sync' AND "status" IN ('pending', 'processing');
