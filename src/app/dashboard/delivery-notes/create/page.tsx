'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';

interface PurchaseOrder {
  id: string;
  po_number: string;
  project: { name: string };
  vendor: { name: string };
}

interface POItem {
  id: string;
  item_name: string;
  quantity: number;
}

export default function CreateDeliveryNote() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [poItems, setPoItems] = useState<POItem[]>([]);
  const [formData, setFormData] = useState({
    dn_number: '',
    delivery_date: '',
    received_by: '',
    notes: ''
  });
  const [deliveredItems, setDeliveredItems] = useState<{[key: string]: {quantity: number, daily_rate: number}}>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  useEffect(() => {
    if (selectedPO) {
      fetchPOItems();
    }
  }, [selectedPO]);

  const fetchPurchaseOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select(`
        id, po_number,
        projects(name),
        vendors(name)
      `)
      .eq('status', 'confirmed');
    setPurchaseOrders(data || []);
  };

  const fetchPOItems = async () => {
    const { data } = await supabase
      .from('po_items')
      .select('id, item_name, quantity')
      .eq('purchase_order_id', selectedPO);
    setPoItems(data || []);
  };

  const updateDeliveredItem = (itemId: string, field: string, value: number) => {
    setDeliveredItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: dnData, error: dnError } = await supabase
      .from('delivery_notes')
      .insert({
        dn_number: formData.dn_number,
        purchase_order_id: selectedPO,
        delivery_date: formData.delivery_date,
        received_by: formData.received_by,
        notes: formData.notes,
        created_by: user?.id
      })
      .select()
      .single();

    if (dnError) {
      console.error('Error creating DN:', dnError);
      setLoading(false);
      return;
    }

    const dnItems = Object.entries(deliveredItems)
      .filter(([_, item]) => item.quantity > 0)
      .map(([itemId, item]) => ({
        delivery_note_id: dnData.id,
        po_item_id: itemId,
        delivered_quantity: item.quantity,
        daily_rate: item.daily_rate,
        status: 'delivered'
      }));

    const { error: itemsError } = await supabase
      .from('dn_items')
      .insert(dnItems);

    if (itemsError) {
      console.error('Error creating DN items:', itemsError);
    }

    setLoading(false);
    window.location.href = '/dashboard/delivery-notes';
  };

  return (
    <DashboardLayout>
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Delivery Note</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">DN Number</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                value={formData.dn_number}
                onChange={(e) => setFormData({...formData, dn_number: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Delivery Date</label>
              <input
                type="date"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                value={formData.delivery_date}
                onChange={(e) => setFormData({...formData, delivery_date: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Purchase Order</label>
              <select
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                value={selectedPO}
                onChange={(e) => setSelectedPO(e.target.value)}
              >
                <option value="">Select Purchase Order</option>
                {purchaseOrders.map(po => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} - {po.vendor.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Received By</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                value={formData.received_by}
                onChange={(e) => setFormData({...formData, received_by: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          {poItems.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delivered Items</h3>
              <div className="space-y-4">
                {poItems.map(item => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Item</label>
                        <input
                          type="text"
                          readOnly
                          className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50"
                          value={item.item_name}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Delivered Quantity (Max: {item.quantity})
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          className="mt-1 block w-full rounded-md border-gray-300"
                          value={deliveredItems[item.id]?.quantity || ''}
                          onChange={(e) => updateDeliveredItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Daily Rate</label>
                        <input
                          type="number"
                          step="0.01"
                          className="mt-1 block w-full rounded-md border-gray-300"
                          value={deliveredItems[item.id]?.daily_rate || ''}
                          onChange={(e) => updateDeliveredItem(item.id, 'daily_rate', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Delivery Note'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}