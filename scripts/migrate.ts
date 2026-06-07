import pino from 'pino';
import { execSync } from 'child_process';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

const start = performance.now();
logger.info('migration_start');

try {
  execSync('node_modules/.bin/prisma migrate deploy', { stdio: 'inherit' });
  const durationMs = Math.round(performance.now() - start);
  logger.info({ durationMs }, 'migration_complete');
} catch (error) {
  const durationMs = Math.round(performance.now() - start);
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stderr = error instanceof Error && 'stderr' in error ? String((error as Error & { stderr?: Buffer }).stderr) : undefined;
  logger.error({ error: errorMessage, stderr, durationMs }, 'migration_failed');
  process.exit(1);
}
