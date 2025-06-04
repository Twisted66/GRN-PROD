import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { dnItemId, returnedQuantity, returnDate } = req.body;

    if (!dnItemId || !returnedQuantity || !returnDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get current DN item
    const { data: dnItem, error: fetchError } = await supabase
      .from('dn_items')
      .select('*')
      .eq('id', dnItemId)
      .single();

    if (fetchError || !dnItem) {
      return res.status(404).json({ error: 'DN item not found' });
    }

    const newReturnedQuantity = dnItem.returned_quantity + returnedQuantity;
    const isFullyReturned = newReturnedQuantity >= dnItem.delivered_quantity;
    const newStatus = isFullyReturned ? 'fully_returned' : 'partial_return';

    // Update DN item
    const { error: updateError } = await supabase
      .from('dn_items')
      .update({
        returned_quantity: newReturnedQuantity,
        returned_at: returnDate,
        status: newStatus
      })
      .eq('id', dnItemId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update DN item' });
    }

    // Log audit trail
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('audit_logs').insert({
      user_id: user?.id,
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
      }
    });

    res.status(200).json({ 
      success: true, 
      message: 'Return processed successfully',
      newStatus,
      newReturnedQuantity
    });

  } catch (error) {
    console.error('Error processing return:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}