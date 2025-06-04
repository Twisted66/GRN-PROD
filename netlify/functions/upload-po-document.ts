import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, fileName, poId } = req.body;

    if (!file || !fileName || !poId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(file, 'base64');
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('purchase-orders')
      .upload(`${poId}/${fileName}`, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error('Upload error:', error);
      return res.status(500).json({ error: 'Upload failed' });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('purchase-orders')
      .getPublicUrl(data.path);

    // Update PO with document URL
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({ document_url: urlData.publicUrl })
      .eq('id', poId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update PO' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'File uploaded successfully',
      url: urlData.publicUrl
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}