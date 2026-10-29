import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Drizzle client over node-postgres, mirroring src/lib/prisma.ts:
 * the connection pool is created once at module load and cached on globalThis
 * outside production so Next.js hot reload does not leak connections.
 */
const globalForDrizzle = globalThis as unknown as {
  drizzlePool: Pool | undefined;
  drizzleDb: ReturnType<typeof createDrizzle> | undefined;
};

export const pool =
  globalForDrizzle.drizzlePool ??
  new Pool({ connectionString: process.env.DATABASE_URL! });

function createDrizzle() {
  return drizzle(pool, { schema });
}

export const db = globalForDrizzle.drizzleDb ?? createDrizzle();

if (process.env.NODE_ENV !== "production") {
  globalForDrizzle.drizzlePool = pool;
  globalForDrizzle.drizzleDb = db;
}

export { schema };
export type Db = typeof db;

/**
 * The transaction handle `db.transaction(fn)` hands its callback. Write paths
 * take `Db | Tx` and are typed against the smaller `Pick<...>` they actually
 * use, so the same helper serves both the root client and a transaction.
 */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
