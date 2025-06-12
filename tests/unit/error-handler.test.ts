import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { 
  AppError, 
  ValidationError, 
  AuthenticationError, 
  getDisplayMessage, 
  handleAsyncError,
  safeAsync 
} from '@/lib/error-handler';
import { ZodError } from 'zod';

// Mock console methods
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('Error Handler', () => {
  beforeEach(() => {
    mockConsoleError.mockClear();
  });

  describe('AppError', () => {
    it('should create an app error with correct properties', () => {
      const error = new AppError(
        'Test error',
        'validation',
        'User friendly message',
        400,
        { field: 'test' }
      );

      expect(error.message).toBe('Test error');
      expect(error.category).toBe('validation');
      expect(error.userMessage).toBe('User friendly message');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'test' });
      expect(error.id).toMatch(/^ERR_\d+_[a-z0-9]+$/);
      expect(error.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with default values', () => {
      const error = new ValidationError('Invalid input');

      expect(error.category).toBe('validation');
      expect(error.statusCode).toBe(400);
      expect(error.userMessage).toBe('Please check your input and try again.');
    });
  });

  describe('AuthenticationError', () => {
    it('should create an authentication error with default values', () => {
      const error = new AuthenticationError();

      expect(error.category).toBe('authentication');
      expect(error.statusCode).toBe(401);
      expect(error.userMessage).toBe('Please log in to continue.');
    });
  });

  describe('getDisplayMessage', () => {
    it('should return user message for AppError', () => {
      const error = new ValidationError('Test validation error');
      const message = getDisplayMessage(error);
      expect(message).toBe('Please check your input and try again.');
    });

    it('should handle ZodError', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number'
        }
      ]);

      const message = getDisplayMessage(zodError);
      expect(message).toBe('Invalid name: Expected string, received number');
    });

    it('should handle network errors', () => {
      const error = new Error('Network Error occurred');
      const message = getDisplayMessage(error);
      expect(message).toBe('Connection error. Please check your internet connection and try again.');
    });

    it('should handle timeout errors', () => {
      const error = new Error('Request timeout');
      const message = getDisplayMessage(error);
      expect(message).toBe('Request timed out. Please try again.');
    });

    it('should handle 401 status', () => {
      const error = { status: 401, message: 'Unauthorized' };
      const message = getDisplayMessage(error);
      expect(message).toBe('Please log in to continue.');
    });

    it('should handle 403 status', () => {
      const error = { status: 403, message: 'Forbidden' };
      const message = getDisplayMessage(error);
      expect(message).toBe('You do not have permission to perform this action.');
    });

    it('should handle 500+ status', () => {
      const error = { status: 500, message: 'Internal Server Error' };
      const message = getDisplayMessage(error);
      expect(message).toBe('A system error occurred. Please try again later.');
    });

    it('should return fallback message for unknown errors', () => {
      const error = new Error('Unknown error');
      const message = getDisplayMessage(error);
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('handleAsyncError', () => {
    it('should handle and format errors correctly', () => {
      const error = new ValidationError('Test error');
      const result = handleAsyncError(error, 'test context');

      expect(result.errorId).toMatch(/^ERR_\d+_[a-z0-9]+$/);
      expect(result.message).toBe('Please check your input and try again.');
      expect(result.category).toBe('validation');
      expect(result.statusCode).toBe(400);
    });
  });

  describe('safeAsync', () => {
    it('should return result on success', async () => {
      const successPromise = Promise.resolve('success');
      const [result, error] = await safeAsync(successPromise);

      expect(result).toBe('success');
      expect(error).toBeNull();
    });

    it('should return error on failure', async () => {
      const failurePromise = Promise.reject(new Error('Test error'));
      const [result, error] = await safeAsync(failurePromise, 'test context');

      expect(result).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message).toBe('Test error');
      expect(error?.userMessage).toBe('An unexpected error occurred. Please try again.');
    });

    it('should handle AppError correctly', async () => {
      const appError = new ValidationError('Validation failed');
      const failurePromise = Promise.reject(appError);
      const [result, error] = await safeAsync(failurePromise);

      expect(result).toBeNull();
      expect(error?.category).toBe('validation');
      expect(error?.userMessage).toBe('Please check your input and try again.');
    });
  });
});