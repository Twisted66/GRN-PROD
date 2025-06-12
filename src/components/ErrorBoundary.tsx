'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logError, getDisplayMessage } from '@/lib/error-handler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorId: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: null
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    const errorId = logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    });

    this.setState({ errorId });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const displayMessage = this.state.error ? getDisplayMessage(this.state.error) : 'An unexpected error occurred';

      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="text-destructive">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {displayMessage}
              </p>
              
              {this.state.errorId && (
                <p className="text-xs text-muted-foreground">
                  Error ID: {this.state.errorId}
                </p>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="outline">
                  Try Again
                </Button>
                <Button onClick={this.handleReload}>
                  Reload Page
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    Debug Information
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to handle errors
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    logError(error, { source: 'useErrorHandler' });
    setError(error);
  }, []);

  // Throw error to be caught by ErrorBoundary
  if (error) {
    throw error;
  }

  return { handleError, resetError };
};

// Higher-order component for class components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}