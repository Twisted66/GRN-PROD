import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create authenticated Supabase client for functions
export function createAuthenticatedClient(authToken?: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    },
  });
  
  return supabase;
}

// Extract auth token from request
export function extractAuthToken(req: any): string | null {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  
  if (!authHeader) return null;
  
  // Handle "Bearer token" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
}

// Verify user authentication and get user info
export async function authenticateUser(supabase: SupabaseClient) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { success: false, error: 'Authentication required', user: null };
    }
    
    return { success: true, error: null, user };
  } catch (error) {
    return { success: false, error: 'Invalid authentication token', user: null };
  }
}

// Check if user has required role
export async function checkUserRole(supabase: SupabaseClient, userId: string, requiredRoles: string[]): Promise<boolean> {
  try {
    const { data: userData, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (error || !userData) {
      return false;
    }
    
    return requiredRoles.includes(userData.role);
  } catch (error) {
    return false;
  }
}

// Check if user can access project
export async function checkProjectAccess(supabase: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  try {
    // First check if user is admin/manager
    const hasRole = await checkUserRole(supabase, userId, ['admin', 'manager']);
    if (hasRole) return true;
    
    // Check if user created the project
    const { data: project, error } = await supabase
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single();
    
    if (error || !project) {
      return false;
    }
    
    return project.created_by === userId;
  } catch (error) {
    return false;
  }
}

// Check if user can access purchase order
export async function checkPurchaseOrderAccess(supabase: SupabaseClient, userId: string, poId: string): Promise<boolean> {
  try {
    // Get the project ID for this purchase order
    const { data: po, error } = await supabase
      .from('purchase_orders')
      .select('project_id')
      .eq('id', poId)
      .single();
    
    if (error || !po) {
      return false;
    }
    
    // Check project access
    return await checkProjectAccess(supabase, userId, po.project_id);
  } catch (error) {
    return false;
  }
}

// Check if user can access delivery note item
export async function checkDeliveryNoteItemAccess(supabase: SupabaseClient, userId: string, dnItemId: string): Promise<boolean> {
  try {
    // Get the purchase order ID through delivery note
    const { data: dnItem, error } = await supabase
      .from('dn_items')
      .select(`
        delivery_notes!inner(purchase_order_id)
      `)
      .eq('id', dnItemId)
      .single();
    
    if (error || !dnItem) {
      return false;
    }
    
    // Check purchase order access
    return await checkPurchaseOrderAccess(supabase, userId, dnItem.delivery_notes.purchase_order_id);
  } catch (error) {
    return false;
  }
}

// Response helpers
export const responses = {
  unauthorized: (message = 'Authentication required') => ({
    statusCode: 401,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message })
  }),
  
  forbidden: (message = 'Access denied') => ({
    statusCode: 403,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message })
  }),
  
  badRequest: (message = 'Invalid request', errors?: string[]) => ({
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message, errors })
  }),
  
  notFound: (message = 'Resource not found') => ({
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message })
  }),
  
  serverError: (message = 'Internal server error') => ({
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message })
  }),
  
  success: (data: any) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  
  pdf: (pdfBuffer: Buffer, filename = 'document.pdf') => ({
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}`
    },
    body: pdfBuffer.toString('base64'),
    isBase64Encoded: true
  })
};