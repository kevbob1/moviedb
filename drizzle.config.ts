import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for the Prisma -> Drizzle strangler (Phase 4).
 *
 * Drizzle is now the migration authority: `drizzle/migrations` is the source of
 * truth and `scripts/migrate.ts` (compiled to scripts/migrate.js) applies it
 * through drizzle-orm's node-postgres migrator. Nothing in the app imports this
 * file.
 *
 * DATABASE_URL is read from the environment (same variable drizzle/db.ts uses)
 * — drizzle-kit does not load .env by itself.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
