import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema for Request + Job — the migration authority since Phase 4 of
 * the Prisma -> Drizzle strangler. `drizzle-kit generate` diffs this file
 * against drizzle/migrations/meta and emits the next migration.
 *
 * Notes:
 * - status/media_type/job.type stay `text` (no pg enums) to match Prisma's String.
 * - timestamps are `timestamp(3)` without time zone, matching Prisma's DateTime.
 * - `jobs_singleton_live_type_key` is a partial unique index the old Prisma
 *   datamodel could not express (historical migration 20261020050000), hence
 *   raw `sql` here.
 */

/** status: pending | downloading | fulfilled (see RequestStatus in src/lib/request-lifecycle/fsm.ts) */
export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  tmdbId: integer("tmdb_id"),
  seasonNumber: integer("season_number"),
  posterPath: text("poster_path"),
  releaseDate: text("release_date"), // year or yyyy-mm-dd; not a precise moment
  overview: text("overview"),
  genreIds: integer("genre_ids")
    .array()
    .notNull()
    .default(sql`'{}'::integer[]`),
  requestedAt: timestamp("requested_at", { precision: 3 }).notNull().defaultNow(),
  requestedBy: text("requested_by").notNull(), // opaque identifier; no User relation
  resolvedAt: timestamp("resolved_at", { precision: 3 }),
  status: text("status").notNull().default("pending"),
  mediaType: text("media_type").notNull().default("movie"), // movie | tv
  torrentHash: text("torrent_hash"),
  torrentProblem: text("torrent_problem"),
  suggestionHash: text("suggestion_hash"),
  suggestionScore: doublePrecision("suggestion_score"),
  suggestionComputedAt: timestamp("suggestion_computed_at", { precision: 3 }),
});

/**
 * status: pending | processing | completed | failed
 * type:   open set registered via registerJobType(); known values:
 *   - request_notification
 *   - tv_series_request_notification
 */
export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    // No column mapping: the live column really is camelCase "maxAttempts".
    maxAttempts: integer("maxAttempts").notNull().default(3),
    error: text("error"),
    createdAt: timestamp("created_at", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
    completedAt: timestamp("completed_at", { precision: 3 }),
  },
  (table) => [
    index("jobs_status_idx").on(table.status),
    index("jobs_status_created_at_idx").on(table.status, table.createdAt),
    // Concurrency guard for singleton job types: partial unique index on (type)
    // WHERE type = 'transmission_sync' AND status IN ('pending','processing').
    uniqueIndex("jobs_singleton_live_type_key")
      .on(table.type)
      .where(
        sql`${table.type} = 'transmission_sync' AND ${table.status} IN ('pending', 'processing')`,
      ),
  ],
);

export type RequestRow = typeof requests.$inferSelect;
export type NewRequestRow = typeof requests.$inferInsert;
export type JobRow = typeof jobs.$inferSelect;
export type NewJobRow = typeof jobs.$inferInsert;
