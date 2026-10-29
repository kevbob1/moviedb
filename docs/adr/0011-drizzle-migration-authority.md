# ADR-0011: Drizzle Becomes the Migration Authority (Prisma Removed)

## Status

Accepted (2026-10-29).

## Context

Phases 1–3 of the Prisma → Drizzle strangler moved application code onto
`drizzle/db.ts` and `drizzle/schema.ts` (commits `7706602`, `f8deda6`,
`d4d87a0`). What remained was the migration path and its scaffolding:

- Two schema definitions (`prisma/schema.prisma`, `drizzle/schema.ts`) that had
  to be kept 1:1 by hand — every column change required editing both.
- Two migration histories (`prisma/migrations/*`, empty `drizzle/migrations`).
- Prisma-only bloat with no remaining consumers: `@prisma/client`,
  `@prisma/adapter-pg`, `prisma`, `src/generated/prisma` (generated at
  `npm install`/`postinstall`), `src/lib/prisma.ts`, `prisma.config.ts`, a
  `db:generate-client` step at the front of `npm run check`, a Prisma client
  mock in `src/test/setup.ts`, and Prisma copies/mounts in the Dockerfile,
  `compose.yaml` and the dev image.
- The runtime migration entrypoint (`scripts/migrate.ts`) shelled out to
  `node ./node_modules/prisma/build/index.js migrate deploy`, which forced the
  production image to ship the whole Prisma CLI + engines.

Both compose's `migrate` service and the Helm `db-migrate` Job already ran that
one script, so the migration *seam* existed — only its engine was Prisma.

## Decision

Drizzle is the single migration authority. Prisma is deleted.

- `drizzle/schema.ts` + `drizzle/migrations/` are the source of truth.
  `npm run db:generate` (`drizzle-kit generate`) produces the next migration;
  `drizzle-kit migrate` applies it in dev.
- `scripts/migrate.ts` mounts `drizzle()` over `pg.Pool` and calls
  `migrate(db, { migrationsFolder: './drizzle/migrations' })` from
  `drizzle-orm/node-postgres/migrator`. Its `migration_start` /
  `migration_complete` / `migration_failed` pino events and `durationMs`
  logging are unchanged.
- **One path to production:** compose `migrate` runs `node scripts/migrate.js`;
  the Helm `db-migrate` Job runs `npm run db:migrate`, which is the same
  `node scripts/migrate.js`. No `npx`, no `tsx` at runtime (per AGENTS.md).
  The script is compiled by `tsc` at image build (dev and builder stages).
- The production image ships `drizzle/`, `drizzle.config.ts`,
  `scripts/migrate.js`, `src/lib/logger.js` and `node_modules`; it no longer
  ships `prisma/`, `prisma.config.ts` or `src/generated/`.

### Baseline strategy

`drizzle/migrations/0000_ambiguous_korg.sql` is the full baseline for a fresh
database: `requests` (18 columns), `jobs` (10 columns), `jobs_status_idx`,
`jobs_status_created_at_idx`, and the partial unique index
`jobs_singleton_live_type_key`. It is generated from `drizzle/schema.ts`, whose
types (`text` instead of pg enums, `timestamp(3)` without zone, camelCase
`maxAttempts`) were written to match the Prisma-managed schema exactly.

The journal entry is `{"tag":"0000_ambiguous_korg","when":1793248619911}`.
drizzle-orm's migrator skips a migration when the newest
`drizzle.__drizzle_migrations.created_at` is **not less than** the journal
`when`, so an existing database is baselined by recording that one row — not
by re-running the DDL.

### One-time production cutover (documented only — never run against prod as part of this change)

`0000` must **not** run against production: the tables already exist from the
Prisma migrations, so the `CREATE TABLE` statements would fail. Instead, run
this SQL once, by hand, against the production database before the first deploy
of the Drizzle image (i.e. before the `db-migrate` Helm hook runs):

```sql
-- 1. Create the journal exactly as drizzle-orm's PgDialect.migrate() would.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

-- 2. Record 0000_ambiguous_korg as already applied.
--    hash   = sha256 of drizzle/migrations/0000_ambiguous_korg.sql
--    created_at = journal entry "when" (1793248619911)
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES (
  '9938704abd4f9cc4b59f5e9e8aee8e01674dcad21c3c733dd328e373cb1dc015',
  1793248619911
);

-- 3. Verify: exactly one row, and the next `node scripts/migrate.js` is a no-op.
SELECT id, hash, created_at FROM drizzle.__drizzle_migrations;
```

If `0000_ambiguous_korg.sql` is ever regenerated, its hash changes and this
insert must be recomputed (`sha256sum drizzle/migrations/0000_ambiguous_korg.sql`)
— the deployed image reads the hash from the file at run time, so a stale row
means the migrator will try to apply the baseline to a non-empty database.

`_prisma_migrations` is left in place (read-only history); nothing reads it.

## Consequences

- **Positive:** one schema, one history, one migration command; no generated
  client step in `npm run check`; no Prisma engines/CLI in the image; dev and
  prod migrate through identical code.
- **Negative / risks:** the cutover is manual and one-shot per existing
  database. A dev database that already ran the Prisma migrations needs the
  same baseline SQL (or `make dev-reset`, which starts from an empty volume and
  lets `0000` apply normally). Drizzle's schema diffing is stricter than
  Prisma's in a few spots (partial indexes, camelCase columns), so
  `drizzle-kit generate` must be reviewed before committing.
- **Neutral:** historical comments in `src/` that mention Prisma behaviour
  (`@updatedAt`, `@updatedAt`-era `updated_at`, the 20261020050000 partial
  index, "Prisma row" in a test name) are kept as provenance for *why* the code
  looks the way it does.
