'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ApplicationError, logError, getDisplayMessage } from '@/lib/error-handler';

interface ErrorState {
  errors: ApplicationError[];
  isLoading: boolean;
}

interface ErrorContextType {
  // State
  errors: ApplicationError[];
  isLoading: boolean;
  
  // Actions
  addError: (error: any, context?: string) => string;
  removeError: (errorId: string) => void;
  clearAllErrors: () => void;
  setLoading: (loading: boolean) => void;
  
  // Utilities
  handleApiCall: <T>(
    apiCall: () => Promise<T>,
    options?: {
      successMessage?: string;
      errorContext?: string;
      showLoading?: boolean;
    }
  ) => Promise<T | null>;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function useError() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

interface ErrorProviderProps {
  children: ReactNode;
  maxErrors?: number;
}

export function ErrorProvider({ children, maxErrors = 5 }: ErrorProviderProps) {
  const [state, setState] = useState<ErrorState>({
    errors: [],
    isLoading: false
  });

  const addError = useCallback((error: any, context?: string): string => {
    const errorId = logError(error, context);
    const displayMessage = getDisplayMessage(error);
    
    const applicationError: ApplicationError = {
      id: errorId,
      message: error.message || 'Unknown error',
      category: error.category || 'unknown',
      userMessage: displayMessage,
      statusCode: error.statusCode || 500,
      details: error.details,
      timestamp: new Date()
    };

    setState(prev => ({
      ...prev,
      errors: [applicationError, ...prev.errors].slice(0, maxErrors)
    }));

    return errorId;
  }, [maxErrors]);

  const removeError = useCallback((errorId: string) => {
    setState(prev => ({
      ...prev,
      errors: prev.errors.filter(error => error.id !== errorId)
    }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: []
    }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({
      ...prev,
      isLoading: loading
    }));
  }, []);

  const handleApiCall = useCallback(async <T,>(
    apiCall: () => Promise<T>,
    options: {
      successMessage?: string;
      errorContext?: string;
      showLoading?: boolean;
    } = {}
  ): Promise<T | null> => {
    const { errorContext, showLoading = true } = options;

    try {
      if (showLoading) {
        setLoading(true);
      }

      const result = await apiCall();
      
      return result;
    } catch (error) {
      addError(error, errorContext);
      return null;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [addError, setLoading]);

  const value: ErrorContextType = {
    errors: state.errors,
    isLoading: state.isLoading,
    addError,
    removeError,
    clearAllErrors,
    setLoading,
    handleApiCall
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
}

// Hook for handling form errors
export function useFormError() {
  const { addError, removeError } = useError();

  const handleFormError = useCallback((error: any, formContext?: string) => {
    return addError(error, `Form: ${formContext || 'Unknown form'}`);
  }, [addError]);

  return { handleFormError, removeError };
}

// Hook for API calls with automatic error handling
export function useApiCall() {
  const { handleApiCall, isLoading } = useError();

  const apiCall = useCallback(<T,>(
    apiFunction: () => Promise<T>,
    options?: {
      successMessage?: string;
      errorContext?: string;
    }
  ) => {
    return handleApiCall(apiFunction, options);
  }, [handleApiCall]);

  return { apiCall, isLoading };
}