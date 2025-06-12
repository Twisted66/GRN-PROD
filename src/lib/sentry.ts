import * as Sentry from "@sentry/nextjs";

// Sentry configuration for production error tracking
export const initSentry = () => {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      
      // Performance monitoring
      tracesSampleRate: 0.1, // 10% of transactions
      
      // Release tracking
      release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
      
      // Error filtering
      beforeSend(event, hint) {
        // Filter out development errors
        if (process.env.NODE_ENV === 'development') {
          return null;
        }
        
        // Filter out certain errors
        const error = hint.originalException;
        if (error && typeof error === 'object' && 'message' in error) {
          const message = (error as Error).message;
          
          // Skip common, non-critical errors
          if (
            message.includes('Non-Error promise rejection captured') ||
            message.includes('ResizeObserver loop limit exceeded') ||
            message.includes('Network Error') ||
            message.includes('Load failed')
          ) {
            return null;
          }
        }
        
        return event;
      },
      
      // User context
      initialScope: {
        tags: {
          component: "equiprent-app"
        }
      },
      
      // Integrations
      integrations: [
        new Sentry.BrowserTracing({
          // Set up automatic route change tracking for Next.js
          routingInstrumentation: Sentry.nextRouterInstrumentation,
        }),
      ],
    });
  }
};

// Custom error reporting functions
export const reportError = (error: Error, context?: Record<string, any>) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.withScope((scope) => {
      if (context) {
        Object.keys(context).forEach(key => {
          scope.setExtra(key, context[key]);
        });
      }
      Sentry.captureException(error);
    });
  } else {
    console.error('Error:', error, 'Context:', context);
  }
};

export const reportMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureMessage(message, level);
  } else {
    console.log(`[${level.toUpperCase()}]`, message);
  }
};

// Performance monitoring
export const startTransaction = (name: string, op: string) => {
  if (process.env.NODE_ENV === 'production') {
    return Sentry.startTransaction({ name, op });
  }
  return null;
};

// User identification
export const setUser = (user: { id: string; email?: string; role?: string }) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.setUser(user);
  }
};

// Breadcrumb tracking
export const addBreadcrumb = (message: string, category: string, level: 'info' | 'warning' | 'error' = 'info') => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      timestamp: Date.now() / 1000,
    });
  }
};