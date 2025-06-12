import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { 
  createAuthenticatedClient,
  extractAuthToken,
  authenticateUser,
  checkUserRole,
  checkProjectAccess,
  responses 
} from '@/lib/auth-utils';

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
  })),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe('Auth Utils Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractAuthToken', () => {
    it('should extract Bearer token', () => {
      const req = {
        headers: {
          authorization: 'Bearer abc123'
        }
      };

      const token = extractAuthToken(req);
      expect(token).toBe('abc123');
    });

    it('should handle missing authorization header', () => {
      const req = {
        headers: {}
      };

      const token = extractAuthToken(req);
      expect(token).toBeNull();
    });

    it('should handle Authorization header (capital A)', () => {
      const req = {
        headers: {
          Authorization: 'Bearer xyz789'
        }
      };

      const token = extractAuthToken(req);
      expect(token).toBe('xyz789');
    });

    it('should handle non-Bearer token', () => {
      const req = {
        headers: {
          authorization: 'Basic abc123'
        }
      };

      const token = extractAuthToken(req);
      expect(token).toBe('Basic abc123');
    });
  });

  describe('authenticateUser', () => {
    it('should return success for valid user', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const result = await authenticateUser(mockSupabaseClient as any);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
    });

    it('should return failure for invalid user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      });

      const result = await authenticateUser(mockSupabaseClient as any);

      expect(result.success).toBe(false);
      expect(result.user).toBeNull();
      expect(result.error).toBe('Authentication required');
    });

    it('should handle authentication errors', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Auth failed'));

      const result = await authenticateUser(mockSupabaseClient as any);

      expect(result.success).toBe(false);
      expect(result.user).toBeNull();
      expect(result.error).toBe('Invalid authentication token');
    });
  });

  describe('checkUserRole', () => {
    it('should return true for user with required role', async () => {
      const mockSelect = jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null
          })
        }))
      }));

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect
      });

      const result = await checkUserRole(mockSupabaseClient as any, 'user123', ['admin', 'manager']);

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });

    it('should return false for user without required role', async () => {
      const mockSelect = jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { role: 'user' },
            error: null
          })
        }))
      }));

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect
      });

      const result = await checkUserRole(mockSupabaseClient as any, 'user123', ['admin', 'manager']);

      expect(result).toBe(false);
    });

    it('should return false for database errors', async () => {
      const mockSelect = jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'User not found' }
          })
        }))
      }));

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect
      });

      const result = await checkUserRole(mockSupabaseClient as any, 'user123', ['admin']);

      expect(result).toBe(false);
    });
  });

  describe('responses', () => {
    it('should create unauthorized response', () => {
      const response = responses.unauthorized('Custom message');

      expect(response.statusCode).toBe(401);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(response.body)).toEqual({ error: 'Custom message' });
    });

    it('should create forbidden response', () => {
      const response = responses.forbidden();

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toEqual({ error: 'Access denied' });
    });

    it('should create bad request response with errors', () => {
      const response = responses.badRequest('Invalid data', ['Field required']);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Invalid data',
        errors: ['Field required']
      });
    });

    it('should create success response', () => {
      const data = { id: 1, name: 'Test' };
      const response = responses.success(data);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(data);
    });

    it('should create PDF response', () => {
      const pdfBuffer = Buffer.from('fake pdf content');
      const response = responses.pdf(pdfBuffer, 'test.pdf');

      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/pdf');
      expect(response.headers['Content-Disposition']).toBe('attachment; filename=test.pdf');
      expect(response.isBase64Encoded).toBe(true);
    });
  });
});