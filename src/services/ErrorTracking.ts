// src/services/ErrorTracking.ts
import { logger } from '../../lib/logger';

export interface ErrorContext {
  [key: string]: any;
}

export interface UserContext {
  id: string;
  email?: string;
  name?: string;
}

class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private user: UserContext | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  init(): void {
    if (this.initialized) return;
    
    // Add global error handler
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.captureException(event.error, {
          type: 'uncaught_exception',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.captureException(event.reason, {
          type: 'unhandled_rejection',
        });
      });
    }

    this.initialized = true;
    logger.info('Error tracking initialized');
  }

  setUser(user: UserContext | null): void {
    this.user = user;
  }

  captureException(error: Error | any, context?: ErrorContext): void {
    const errorContext = {
      ...context,
      user: this.user,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
    };

    logger.error(
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
      errorContext
    );
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    const logContext = {
      ...context,
      user: this.user,
    };

    switch (level) {
      case 'info':
        logger.info(message, logContext);
        break;
      case 'warning':
        logger.warn(message, logContext);
        break;
      case 'error':
        logger.error(message, undefined, logContext);
        break;
    }
  }
}

export const errorTracking = ErrorTrackingService.getInstance();
export const initErrorTracking = () => errorTracking.init();
export const captureException = (error: any, context?: any) => errorTracking.captureException(error, context);
export const setUserContext = (user: any) => errorTracking.setUser(user);
