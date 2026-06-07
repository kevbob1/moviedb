import { NextRequest } from 'next/server';
import { logger } from './logger';
import { randomUUID } from 'crypto';

const EXCLUDED_PATHS = ['/api/health/live', '/api/health/readiness'];

export function withLogging<T>(
  handler: (req: Request | NextRequest, context?: T) => Promise<Response>
): (req: Request | NextRequest, context?: T) => Promise<Response> {
  return async (req: Request | NextRequest, context?: T) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (EXCLUDED_PATHS.includes(pathname)) {
      return handler(req, context);
    }

    const requestId = randomUUID();
    const start = performance.now();

    try {
      const response = await handler(req, context);
      const durationMs = Math.round(performance.now() - start);
      logger.info({ method: req.method, path: pathname, status: response.status, durationMs, requestId }, 'request_complete');
      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ method: req.method, path: pathname, error: errorMessage, durationMs, requestId }, 'request_error');
      throw error;
    }
  };
}
