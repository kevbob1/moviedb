import { logger } from '../src/lib/logger';
import { execSync } from 'child_process';

const start = performance.now();
logger.info('migration_start');

try {
  const stdout = execSync('node_modules/.bin/prisma migrate deploy', { encoding: 'utf-8', stdio: 'pipe' });
  const durationMs = Math.round(performance.now() - start);
  logger.info({ durationMs, stdout: stdout.trim() || undefined }, 'migration_complete');
} catch (error) {
  const durationMs = Math.round(performance.now() - start);
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr) : undefined;
  const stdout = error instanceof Error && 'stdout' in error ? String(error.stdout) : undefined;
  logger.error({ error: errorMessage, stderr, stdout, durationMs }, 'migration_failed');
  process.exit(1);
}
