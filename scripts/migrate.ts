import { logger } from '../src/lib/logger';
import { execSync } from 'child_process';

const start = performance.now();
logger.info('migration_start');

try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  const durationMs = Math.round(performance.now() - start);
  logger.info({ durationMs }, 'migration_complete');
} catch (error) {
  const durationMs = Math.round(performance.now() - start);
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error({ error: errorMessage, durationMs }, 'migration_failed');
  process.exit(1);
}
