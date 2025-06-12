import { createClient } from '@supabase/supabase-js';
import { 
  createAuthenticatedClient, 
  extractAuthToken, 
  authenticateUser, 
  checkPurchaseOrderAccess,
  responses 
} from '../../src/lib/auth-utils';
import { fileUploadSchema, validateInput } from '../../src/lib/validation-schemas';

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

    // Validate input data
    const validation = validateInput(fileUploadSchema, req.body);
    if (!validation.success) {
      return res.status(400).json(responses.badRequest('Invalid input data', validation.errors).body);
    }

    const { file, fileName, poId } = validation.data;

    // SECURITY: Check if user has access to this purchase order
    const hasAccess = await checkPurchaseOrderAccess(supabase, user.id, poId);
    if (!hasAccess) {
      return res.status(403).json(responses.forbidden('You do not have access to this purchase order').body);
    }

    // Convert base64 to buffer and validate file size
    let buffer: Buffer;
    try {
      buffer = Buffer.from(file, 'base64');
      
      // Check file size (max 10MB)
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json(responses.badRequest('File too large. Maximum size is 10MB').body);
      }
    } catch (error) {
      return res.status(400).json(responses.badRequest('Invalid file encoding').body);
    }
    
    // Use service role for storage operations (but with validated access)
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Upload to Supabase Storage with user-specific path
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = `${poId}/${user.id}/${Date.now()}-${sanitizedFileName}`;
    
    const { data: uploadData, error: uploadError } = await serviceSupabase.storage
      .from('purchase-orders')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: false // Don't overwrite existing files
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json(responses.serverError('Upload failed').body);
    }

    // Get public URL
    const { data: urlData } = serviceSupabase.storage
      .from('purchase-orders')
      .getPublicUrl(uploadData.path);

    // Update PO with document URL (using authenticated client to respect RLS)
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({ 
        document_url: urlData.publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', poId);

    if (updateError) {
      console.error('Update error:', updateError);
      // Clean up uploaded file on failure
      await serviceSupabase.storage.from('purchase-orders').remove([uploadData.path]);
      return res.status(500).json(responses.serverError('Failed to update purchase order').body);
    }

    return res.status(200).json(responses.success({
      success: true, 
      message: 'File uploaded successfully',
      url: urlData.publicUrl,
      filename: sanitizedFileName
    }).body);

  } catch (error) {
    console.error('Error uploading file:', error);
    return res.status(500).json(responses.serverError().body);
  }
}