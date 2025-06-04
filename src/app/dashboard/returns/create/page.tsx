'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';

interface DNItem {
  id: string;
  delivered_quantity: number;
  returned_quantity: number;
  status: string;
  delivery_notes: {
    dn_number: string;
    delivery_date: string;
  };
  po_items: {
    item_name: string;
    purchase_orders: {
      po_number: string;
      projects: { name: string };
      vendors: { name: string };
    };
  };
}

export default function CreateReturn() {
  const [dnItems, setDnItems] = useState<DNItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<{[key: string]: {quantity: number, return_date: string}}>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDNItems();
  }, []);

  const fetchDNItems = async () => {
    const { data } = await supabase
      .from('dn_items')
      .select(`
        *,
        delivery_notes(dn_number, delivery_date),
        po_items(
          item_name,
          purchase_orders(
            po_number,
            projects(name),
            vendors(name)
          )
        )
      `)
      .in('status', ['delivered', 'partial_return'])
      .order('created_at', { ascending: false });

    setDnItems(data || []);
  };

  const updateSelectedItem = (itemId: string, field: string, value: any) => {
    setSelectedItems(prev => ({
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

    const returnPromises = Object.entries(selectedItems)
      .filter(([_, item]) => item.quantity > 0)
      .map(([itemId, item]) =>
        fetch('/api/process-return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dnItemId: itemId,
            returnedQuantity: item.quantity,
            returnDate: item.return_date
          })
        })
      );

    try {
      await Promise.all(returnPromises);
      setLoading(false);
      window.location.href = '/dashboard/returns';
    } catch (error) {
      console.error('Error processing returns:', error);
      setLoading(false);
    }
  };

  const getAvailableQuantity = (item: DNItem) => {
    return item.delivered_quantity - item.returned_quantity;
  };

  return (
    <DashboardLayout>
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Process Equipment Returns</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {dnItems.length === 0 ? (
                <li className="px-6 py-4 text-center text-gray-500">
                  No items available for return
                </li>
              ) : (
                dnItems.map(item => (
                  <li key={item.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-indigo-600">
                            {item.po_items.purchase_orders.po_number} - {item.po_items.item_name}
                          </p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              item.status === 'delivered' 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {item.status}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              Project: {item.po_items.purchase_orders.projects.name}
                            </p>
                            <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                              Vendor: {item.po_items.purchase_orders.vendors.name}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <p>
                              Delivered: {item.delivered_quantity} | 
                              Returned: {item.returned_quantity} | 
                              Available: {getAvailableQuantity(item)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {getAvailableQuantity(item) > 0 && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Return Quantity (Max: {getAvailableQuantity(item)})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={getAvailableQuantity(item)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                            value={selectedItems[item.id]?.quantity || ''}
                            onChange={(e) => updateSelectedItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Return Date</label>
                          <input
                            type="date"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                            value={selectedItems[item.id]?.return_date || ''}
                            onChange={(e) => updateSelectedItem(item.id, 'return_date', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>

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
              disabled={loading || Object.keys(selectedItems).length === 0}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Process Returns'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}