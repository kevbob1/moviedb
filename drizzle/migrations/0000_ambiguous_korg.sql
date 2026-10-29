CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"maxAttempts" integer DEFAULT 3 NOT NULL,
	"error" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	"completed_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"tmdb_id" integer,
	"season_number" integer,
	"poster_path" text,
	"release_date" text,
	"overview" text,
	"genre_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"requested_at" timestamp (3) DEFAULT now() NOT NULL,
	"requested_by" text NOT NULL,
	"resolved_at" timestamp (3),
	"status" text DEFAULT 'pending' NOT NULL,
	"media_type" text DEFAULT 'movie' NOT NULL,
	"torrent_hash" text,
	"torrent_problem" text,
	"suggestion_hash" text,
	"suggestion_score" double precision,
	"suggestion_computed_at" timestamp (3)
);
--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_status_created_at_idx" ON "jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_singleton_live_type_key" ON "jobs" USING btree ("type") WHERE "jobs"."type" = 'transmission_sync' AND "jobs"."status" IN ('pending', 'processing');