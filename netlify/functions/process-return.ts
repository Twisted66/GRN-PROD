import { createClient } from '@supabase/supabase-js';
import { 
  createAuthenticatedClient, 
  extractAuthToken, 
  authenticateUser, 
  checkDeliveryNoteItemAccess,
  checkUserRole,
  responses 
} from '../../src/lib/auth-utils';
import { returnProcessSchema, validateInput } from '../../src/lib/validation-schemas';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract and validate auth token
    const authToken = extractAuthToken(req);
    if (!authToken) {
      return res.status(401).json(responses.unauthorized().body);
    }

    // Create authenticated Supabase client
    const supabase = createAuthenticatedClient(authToken);
    
    // Authenticate user
    const { success: authSuccess, user, error: authError } = await authenticateUser(supabase);
    if (!authSuccess || !user) {
      return res.status(401).json(responses.unauthorized(authError).body);
    }

    // Check if user has manager/admin role (only they can process returns)
    const hasRole = await checkUserRole(supabase, user.id, ['admin', 'manager']);
    if (!hasRole) {
      return res.status(403).json(responses.forbidden('Only managers and admins can process returns').body);
    }

    // Validate input data
    const validation = validateInput(returnProcessSchema, req.body);
    if (!validation.success) {
      return res.status(400).json(responses.badRequest('Invalid input data', validation.errors).body);
    }

    const { dnItemId, returnedQuantity, returnDate } = validation.data;

    // SECURITY: Check if user has access to this delivery note item
    const hasAccess = await checkDeliveryNoteItemAccess(supabase, user.id, dnItemId);
    if (!hasAccess) {
      return res.status(403).json(responses.forbidden('You do not have access to this delivery note item').body);
    }

    // Get current DN item
    const { data: dnItem, error: fetchError } = await supabase
      .from('dn_items')
      .select('*')
      .eq('id', dnItemId)
      .single();

    if (fetchError || !dnItem) {
      return res.status(404).json(responses.notFound('Delivery note item not found').body);
    }

    // Validate business logic
    const newReturnedQuantity = dnItem.returned_quantity + returnedQuantity;
    if (newReturnedQuantity > dnItem.delivered_quantity) {
      return res.status(400).json(responses.badRequest('Cannot return more than delivered quantity').body);
    }

    if (new Date(returnDate) < new Date(dnItem.created_at)) {
      return res.status(400).json(responses.badRequest('Return date cannot be before delivery date').body);
    }

    const isFullyReturned = newReturnedQuantity >= dnItem.delivered_quantity;
    const newStatus = isFullyReturned ? 'fully_returned' : 'partial_return';

    // Use service role for audit log insertion
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Perform update and audit log in a transaction-like manner
    const { error: updateError } = await supabase
      .from('dn_items')
      .update({
        returned_quantity: newReturnedQuantity,
        returned_at: returnDate,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', dnItemId);

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json(responses.serverError('Failed to update delivery note item').body);
    }

    // Log audit trail with service role
    try {
      await serviceSupabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'RETURN_PROCESSED',
        table_name: 'dn_items',
        record_id: dnItemId,
        old_values: {
          returned_quantity: dnItem.returned_quantity,
          status: dnItem.status
        },
        new_values: {
          returned_quantity: newReturnedQuantity,
          status: newStatus
        },
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent']
      });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
      // Don't fail the request if audit logging fails
    }

    return res.status(200).json(responses.success({
      success: true, 
      message: 'Return processed successfully',
      data: {
        id: dnItemId,
        status: newStatus,
        returned_quantity: newReturnedQuantity,
        remaining_quantity: dnItem.delivered_quantity - newReturnedQuantity
      }
    }).body);

  } catch (error) {
    console.error('Error processing return:', error);
    return res.status(500).json(responses.serverError().body);
  }
}