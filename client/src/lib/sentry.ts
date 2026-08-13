import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error tracking for the frontend
 * Only activates if VITE_SENTRY_DSN environment variable is set
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.info('[Sentry] DSN not configured - error tracking disabled');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      
      // Performance monitoring - sample 10% of page loads
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
      
      // Capture 100% of errors
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      
      integrations: [
        // Browser tracing integration
        Sentry.browserTracingIntegration(),
        // Replay integration for visual debugging
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      
      // Filter out health check and analytics spam
      beforeSend(event) {
        // Don't send errors from browser extensions
        if (event.exception?.values?.some(v => 
          v.stacktrace?.frames?.some(f => 
            f.filename?.includes('extension://') || 
            f.filename?.includes('chrome-extension://')
          )
        )) {
          return null;
        }
        return event;
      },
      
      // Add custom context to all events
      initialScope: {
        tags: {
          service: 'solar-system-web',
        },
      },
    });

    console.info('[Sentry] Error tracking initialized');
  } catch (err) {
    console.error('[Sentry] Failed to initialize:', err);
  }
}
