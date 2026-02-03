import * as Sentry from '@sentry/node';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let initialized = false;

export function initServerSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.2,
  });

  initialized = true;
}

export function captureServerError(
  error: Error,
  context?: { requestId?: string; path?: string; [key: string]: unknown }
): void {
  if (!initialized) return;
  Sentry.withScope(scope => {
    if (context?.requestId) scope.setTag('requestId', context.requestId);
    if (context?.path) scope.setTag('path', context.path);
    scope.setExtras(context || {});
    Sentry.captureException(error);
  });
}

export function withSentry<T>(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<T>
) {
  return async (req: VercelRequest, res: VercelResponse): Promise<T> => {
    initServerSentry();
    try {
      return await handler(req, res);
    } catch (error) {
      captureServerError(error as Error, { path: req.url });
      throw error;
    }
  };
}
