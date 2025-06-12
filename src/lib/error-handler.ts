import { ZodError } from 'zod';

// Types for different error categories
export type ErrorCategory = 'validation' | 'authentication' | 'authorization' | 'network' | 'database' | 'unknown';

export interface ApplicationError {
  id: string;
  message: string;
  category: ErrorCategory;
  userMessage: string;
  statusCode: number;
  details?: any;
  timestamp: Date;
}

// Error classification
export class AppError extends Error {
  public readonly id: string;
  public readonly category: ErrorCategory;
  public readonly userMessage: string;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(
    message: string,
    category: ErrorCategory,
    userMessage: string,
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.id = generateErrorId();
    this.category = category;
    this.userMessage = userMessage;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
  }
}

// Specific error classes
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(
      message,
      'validation',
      'Please check your input and try again.',
      400,
      details
    );
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(
      message,
      'authentication',
      'Please log in to continue.',
      401
    );
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(
      message,
      'authorization',
      'You do not have permission to perform this action.',
      403
    );
  }
}

export class NetworkError extends AppError {
  constructor(message: string) {
    super(
      message,
      'network',
      'Connection error. Please check your internet connection and try again.',
      503
    );
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(
      message,
      'database',
      'A system error occurred. Please try again later.',
      500,
      details
    );
  }
}

// Error ID generator
function generateErrorId(): string {
  return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Error logging function
export const logError = (error: any, context?: any) => {
  const errorInfo = {
    id: error.id || generateErrorId(),
    message: error.message,
    stack: error.stack,
    category: error.category || 'unknown',
    statusCode: error.statusCode || 500,
    context,
    timestamp: new Date().toISOString(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined
  };

  // Console logging for development
  if (process.env.NODE_ENV === 'development') {
    console.error('🚨 Application Error:', errorInfo);
  }

  // Send to external error tracking service (Sentry, etc.)
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.captureException(error, {
      tags: {
        category: error.category || 'unknown',
        errorId: errorInfo.id
      },
      extra: {
        ...errorInfo,
        context
      }
    });
  }

  // Log to server-side logging service in production
  if (process.env.NODE_ENV === 'production') {
    // This would be called from server-side contexts
    // fetch('/api/log-error', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorInfo)
    // }).catch(() => {}); // Fail silently to avoid infinite loops
  }

  return errorInfo.id;
};

// User-friendly error message generator
export const getDisplayMessage = (error: any): string => {
  if (error instanceof AppError) {
    return error.userMessage;
  }

  if (error instanceof ZodError) {
    const firstError = error.errors[0];
    return `Invalid ${firstError.path.join('.')}: ${firstError.message}`;
  }

  // Common error patterns
  if (error.message?.includes('Network Error') || error.message?.includes('fetch')) {
    return 'Connection error. Please check your internet connection and try again.';
  }

  if (error.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  if (error.message?.includes('Unauthorized') || error.status === 401) {
    return 'Please log in to continue.';
  }

  if (error.message?.includes('Forbidden') || error.status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (error.status >= 500) {
    return 'A system error occurred. Please try again later.';
  }

  // Fallback for unknown errors
  return 'An unexpected error occurred. Please try again.';
};

// Error boundary helper
export const handleAsyncError = (error: any, context?: string) => {
  const errorId = logError(error, { context });
  const displayMessage = getDisplayMessage(error);
  
  return {
    errorId,
    message: displayMessage,
    category: error.category || 'unknown',
    statusCode: error.statusCode || 500
  };
};

// API error handler for fetch requests
export const handleApiError = async (response: Response): Promise<never> => {
  let errorData: any = {};
  
  try {
    errorData = await response.json();
  } catch {
    // Response is not JSON
  }

  const message = errorData.message || errorData.error || `HTTP ${response.status}`;
  
  switch (response.status) {
    case 400:
      throw new ValidationError(message, errorData.errors);
    case 401:
      throw new AuthenticationError(message);
    case 403:
      throw new AuthorizationError(message);
    case 404:
      throw new AppError(message, 'unknown', 'The requested resource was not found.', 404);
    case 500:
    case 502:
    case 503:
    case 504:
      throw new DatabaseError(message, errorData);
    default:
      throw new AppError(message, 'unknown', 'An unexpected error occurred.', response.status);
  }
};

// Utility for handling promise rejections
export const safeAsync = async <T>(
  promise: Promise<T>,
  context?: string
): Promise<[T | null, ApplicationError | null]> => {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    const errorInfo = handleAsyncError(error, context);
    return [null, {
      id: errorInfo.errorId,
      message: error.message,
      category: errorInfo.category as ErrorCategory,
      userMessage: errorInfo.message,
      statusCode: errorInfo.statusCode,
      timestamp: new Date()
    }];
  }
};