import { z } from 'zod';

// Base schemas for common types
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const dateSchema = z.string().datetime('Invalid date format');

// File upload validation
export const fileUploadSchema = z.object({
  file: z.string().min(1, 'File content is required'),
  fileName: z.string()
    .min(1, 'Filename is required')
    .max(255, 'Filename too long')
    .regex(/^[a-zA-Z0-9._-]+\.(pdf|doc|docx)$/i, 'Invalid file type. Only PDF, DOC, DOCX allowed'),
  poId: uuidSchema
});

// Return processing validation
export const returnProcessSchema = z.object({
  dnItemId: uuidSchema,
  returnedQuantity: z.number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be positive')
    .max(10000, 'Quantity too large'),
  returnDate: dateSchema
});

// Report generation validation
export const reportGenerationSchema = z.object({
  projectId: uuidSchema,
  startDate: z.string().date('Invalid start date format'),
  endDate: z.string().date('Invalid end date format')
}).refine(data => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return start <= end;
}, {
  message: 'End date must be after start date',
  path: ['endDate']
});

// Project creation/update validation
export const projectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(255, 'Project name too long'),
  description: z.string()
    .max(1000, 'Description too long')
    .optional(),
  status: z.enum(['active', 'completed', 'cancelled'], {
    errorMap: () => ({ message: 'Invalid project status' })
  }).optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional()
});

// Vendor validation
export const vendorSchema = z.object({
  name: z.string()
    .min(1, 'Vendor name is required')
    .max(255, 'Vendor name too long'),
  contact_person: z.string()
    .max(255, 'Contact person name too long')
    .optional(),
  email: z.string()
    .email('Invalid email format')
    .optional(),
  phone: z.string()
    .max(50, 'Phone number too long')
    .optional(),
  address: z.string()
    .max(500, 'Address too long')
    .optional(),
  tax_id: z.string()
    .max(100, 'Tax ID too long')
    .optional()
});

// Purchase order validation
export const purchaseOrderSchema = z.object({
  po_number: z.string()
    .min(1, 'PO number is required')
    .max(100, 'PO number too long'),
  project_id: uuidSchema,
  vendor_id: uuidSchema,
  status: z.enum(['draft', 'sent', 'confirmed', 'completed', 'cancelled'], {
    errorMap: () => ({ message: 'Invalid PO status' })
  }).optional(),
  order_date: z.string().date().optional(),
  delivery_date: z.string().date().optional(),
  notes: z.string()
    .max(1000, 'Notes too long')
    .optional()
});

// Delivery note validation
export const deliveryNoteSchema = z.object({
  purchase_order_id: uuidSchema,
  delivery_date: z.string().date(),
  delivered_by: z.string()
    .max(255, 'Delivered by field too long')
    .optional(),
  received_by: z.string()
    .max(255, 'Received by field too long')
    .optional(),
  notes: z.string()
    .max(1000, 'Notes too long')
    .optional()
});

// Helper function for validation
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}

// Sanitization helper
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/[<>]/g, ''); // Remove < and > characters
}