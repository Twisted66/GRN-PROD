import { describe, expect, it } from '@jest/globals';
import { 
  validateInput, 
  projectSchema, 
  vendorSchema, 
  fileUploadSchema,
  returnProcessSchema,
  sanitizeString 
} from '@/lib/validation-schemas';

describe('Validation Schemas', () => {
  describe('projectSchema', () => {
    it('should validate a valid project', () => {
      const validProject = {
        name: 'Test Project',
        description: 'A test project',
        status: 'active' as const,
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      };

      const result = validateInput(projectSchema, validProject);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Project');
      }
    });

    it('should reject project with empty name', () => {
      const invalidProject = {
        name: '',
        status: 'active' as const
      };

      const result = validateInput(projectSchema, invalidProject);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain('name: String must contain at least 1 character(s)');
      }
    });

    it('should reject project with invalid status', () => {
      const invalidProject = {
        name: 'Test Project',
        status: 'invalid_status'
      };

      const result = validateInput(projectSchema, invalidProject);
      expect(result.success).toBe(false);
    });
  });

  describe('vendorSchema', () => {
    it('should validate a valid vendor', () => {
      const validVendor = {
        name: 'Test Vendor',
        email: 'vendor@example.com',
        phone: '+1234567890'
      };

      const result = validateInput(vendorSchema, validVendor);
      expect(result.success).toBe(true);
    });

    it('should reject vendor with invalid email', () => {
      const invalidVendor = {
        name: 'Test Vendor',
        email: 'invalid-email'
      };

      const result = validateInput(vendorSchema, invalidVendor);
      expect(result.success).toBe(false);
    });
  });

  describe('fileUploadSchema', () => {
    it('should validate a valid file upload', () => {
      const validUpload = {
        file: 'base64encodedcontent',
        fileName: 'document.pdf',
        poId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = validateInput(fileUploadSchema, validUpload);
      expect(result.success).toBe(true);
    });

    it('should reject invalid file types', () => {
      const invalidUpload = {
        file: 'base64encodedcontent',
        fileName: 'document.exe',
        poId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = validateInput(fileUploadSchema, invalidUpload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID', () => {
      const invalidUpload = {
        file: 'base64encodedcontent',
        fileName: 'document.pdf',
        poId: 'invalid-uuid'
      };

      const result = validateInput(fileUploadSchema, invalidUpload);
      expect(result.success).toBe(false);
    });
  });

  describe('returnProcessSchema', () => {
    it('should validate a valid return process', () => {
      const validReturn = {
        dnItemId: '123e4567-e89b-12d3-a456-426614174000',
        returnedQuantity: 5,
        returnDate: '2025-01-12T10:00:00Z'
      };

      const result = validateInput(returnProcessSchema, validReturn);
      expect(result.success).toBe(true);
    });

    it('should reject negative quantities', () => {
      const invalidReturn = {
        dnItemId: '123e4567-e89b-12d3-a456-426614174000',
        returnedQuantity: -1,
        returnDate: '2025-01-12T10:00:00Z'
      };

      const result = validateInput(returnProcessSchema, invalidReturn);
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const invalidReturn = {
        dnItemId: '123e4567-e89b-12d3-a456-426614174000',
        returnedQuantity: 5,
        returnDate: 'invalid-date'
      };

      const result = validateInput(returnProcessSchema, invalidReturn);
      expect(result.success).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove script tags', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World';
      const result = sanitizeString(maliciousInput);
      expect(result).toBe('Hello World');
    });

    it('should remove angle brackets', () => {
      const input = 'Hello <world>';
      const result = sanitizeString(input);
      expect(result).toBe('Hello world');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeString(input);
      expect(result).toBe('Hello World');
    });
  });
});