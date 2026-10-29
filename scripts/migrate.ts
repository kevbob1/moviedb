import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { logger } from '../src/lib/logger.js';

/**
 * The single migration path: compose `migrate` service and the Helm db-migrate
 * Job both run `node scripts/migrate.js`, which applies drizzle/migrations to
 * $DATABASE_URL via drizzle-orm's node-postgres migrator.
 *
 * Applied migrations are journalled in `drizzle.__drizzle_migrations`; a
 * migration is skipped when its journal `when` (folderMillis) is not newer than
 * the newest recorded `created_at`. See docs/adr/0011-drizzle-migration-authority.md
 * for the one-time cutover that seeds that table on an existing Prisma database.
 */

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../drizzle/migrations', import.meta.url));

async function main() {
  const start = performance.now();
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    logger.error({ error: 'DATABASE_URL is not set' }, 'migration_failed');
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString });

  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
    const durationMs = Math.round(performance.now() - start);
    logger.info({ durationMs }, 'migration_complete');
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage, durationMs }, 'migration_failed');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

await main();
