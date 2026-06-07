import { logger } from '../src/lib/logger.js';
import { execSync } from 'child_process';

const start = performance.now();
logger.info('migration_start');

try {
  execSync('node ./node_modules/prisma/build/index.js migrate deploy', { stdio: 'inherit' });
  const durationMs = Math.round(performance.now() - start);
  logger.info({ durationMs }, 'migration_complete');
} catch (error) {
  const durationMs = Math.round(performance.now() - start);
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error({ error: errorMessage, durationMs }, 'migration_failed');
  process.exit(1);
}
