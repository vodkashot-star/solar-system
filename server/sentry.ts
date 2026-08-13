import * as Sentry from '@sentry/node';
import { logger } from './logger';

/**
 * Initialize Sentry error tracking for the backend
 * Only activates if SENTRY_DSN environment variable is set
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.info('Sentry DSN not configured - error tracking disabled');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      
      // Performance monitoring - sample 10% of transactions
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Filter out health check spam from traces
      beforeSendTransaction(event) {
        if (event.request?.url?.includes('/api/health')) {
          return null;
        }
        return event;
      },
      
      // Add server context to all events
      initialScope: {
        tags: {
          service: 'solar-system-api',
        },
      },
    });

    logger.info({ environment: process.env.NODE_ENV }, 'Sentry error tracking initialized');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Sentry');
  }
}

/**
 * Capture an exception and send to Sentry
 */
export function captureException(err: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.setContext('error_context', context);
  }
  Sentry.captureException(err);
}

/**
 * Capture a message and send to Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}
