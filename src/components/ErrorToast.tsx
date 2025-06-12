'use client'

import React, { useEffect } from 'react';
import { useError } from '@/contexts/ErrorContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ToastProps {
  id: string;
  message: string;
  category: string;
  onDismiss: () => void;
  duration?: number;
}

function Toast({ id, message, category, onDismiss, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [duration, onDismiss]);

  const getToastStyles = () => {
    switch (category) {
      case 'validation':
        return 'border-yellow-500 bg-yellow-50 text-yellow-800';
      case 'authentication':
      case 'authorization':
        return 'border-red-500 bg-red-50 text-red-800';
      case 'network':
        return 'border-blue-500 bg-blue-50 text-blue-800';
      case 'database':
        return 'border-orange-500 bg-orange-50 text-orange-800';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (category) {
      case 'validation':
        return '⚠️';
      case 'authentication':
      case 'authorization':
        return '🔒';
      case 'network':
        return '🌐';
      case 'database':
        return '💾';
      default:
        return '❌';
    }
  };

  return (
    <Card className={`mb-2 border-l-4 ${getToastStyles()} animate-in slide-in-from-right duration-300`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2">
            <span className="text-lg">{getIcon()}</span>
            <div>
              <p className="font-medium text-sm">{message}</p>
              <p className="text-xs opacity-75 mt-1">Error ID: {id}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0 hover:bg-black/10"
          >
            ×
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ErrorToastContainer() {
  const { errors, removeError } = useError();

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
      {errors.map((error) => (
        <Toast
          key={error.id}
          id={error.id}
          message={error.userMessage}
          category={error.category}
          onDismiss={() => removeError(error.id)}
          duration={error.category === 'validation' ? 7000 : 5000}
        />
      ))}
    </div>
  );
}

// Loading overlay component
export function LoadingOverlay() {
  const { isLoading } = useError();

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <Card className="p-6">
        <CardContent className="flex items-center space-x-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p>Loading...</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Error summary component for debugging
export function ErrorSummary() {
  const { errors, clearAllErrors } = useError();

  if (process.env.NODE_ENV !== 'development' || errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-md">
      <Card className="border-dashed border-gray-400">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Debug: Recent Errors</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllErrors}
              className="h-6 px-2 text-xs"
            >
              Clear
            </Button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {errors.slice(0, 3).map((error) => (
              <div key={error.id} className="text-xs text-muted-foreground">
                <span className="font-mono">{error.category}</span>: {error.message}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}