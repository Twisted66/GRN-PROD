'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { supabase } from '@/lib/supabase';

interface Project {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
}

export default function CreatePurchaseOrder() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [formData, setFormData] = useState({
    po_number: '',
    project_id: '',
    vendor_id: '',
    po_date: '',
    total_amount: '',
  });
  const [items, setItems] = useState([{
    item_name: '',
    description: '',
    quantity: '',
    unit_price: '',
    line_total: '0'
  }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchVendors();
  }, []);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('status', 'active');
    setProjects(data || []);
  };

  const fetchVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('id, name');
    setVendors(data || []);
  };

  const addItem = () => {
    setItems([...items, {
      item_name: '',
      description: '',
      quantity: '',
      unit_price: '',
      line_total: '0'
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      const qty = parseFloat(newItems[index].quantity) || 0;
      const price = parseFloat(newItems[index].unit_price) || 0;
      newItems[index].line_total = (qty * price).toString();
    }
    
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (parseFloat(item.line_total) || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: formData.po_number,
        project_id: formData.project_id,
        vendor_id: formData.vendor_id,
        po_date: formData.po_date,
        total_amount: calculateTotal(),
        created_by: user?.id,
      })
      .select()
      .single();

    if (poError) {
      console.error('Error creating PO:', poError);
      setLoading(false);
      return;
    }

    const { error: itemsError } = await supabase
      .from('po_items')
      .insert(
        items.map(item => ({
          purchase_order_id: poData.id,
          item_name: item.item_name,
          description: item.description,
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price),
          line_total: parseFloat(item.line_total),
        }))
      );

    if (itemsError) {
      console.error('Error creating PO items:', itemsError);
    }

    setLoading(false);
    window.location.href = '/dashboard/purchase-orders';
  };

  return (
    <DashboardLayout>
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Purchase Order</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">PO Number</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formData.po_number}
                onChange={(e) => setFormData({...formData, po_number: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">PO Date</label>
              <input
                type="date"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formData.po_date}
                onChange={(e) => setFormData({...formData, po_date: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Project</label>
              <select
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formData.project_id}
                onChange={(e) => setFormData({...formData, project_id: e.target.value})}
              >
                <option value="">Select Project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Vendor</label>
              <select
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formData.vendor_id}
                onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
              >
                <option value="">Select Vendor</option>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Add Item
              </button>
            </div>
            
            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Item Name</label>
                    <input
                      type="text"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      value={item.item_name}
                      onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Unit Price</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700">Line Total</label>
                      <input
                        type="text"
                        readOnly
                        className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50"
                        value={item.line_total}
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="ml-2 bg-red-600 text-white px-2 py-2 rounded-md hover:bg-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            <div className="text-right">
              <span className="text-lg font-bold">Total: ${calculateTotal().toFixed(2)}</span>
            </div>
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
              disabled={loading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}