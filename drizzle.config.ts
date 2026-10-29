import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for Phase 1 of the Prisma -> Drizzle strangler.
 *
 * Prisma (prisma/schema.prisma + prisma/migrations) is still the migration
 * authority; this config exists so `drizzle-kit generate` can prove parity.
 * Nothing in the app imports it.
 *
 * DATABASE_URL is read from the environment (same variable src/lib/prisma.ts
 * uses) — drizzle-kit does not load .env by itself.
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
