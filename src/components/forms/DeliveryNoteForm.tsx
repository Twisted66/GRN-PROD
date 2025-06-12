'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const dnItemSchema = z.object({
  po_item_id: z.string().min(1, 'PO item is required'),
  delivered_quantity: z.number().min(1, 'Delivered quantity must be at least 1'),
  daily_rate: z.number().min(0, 'Daily rate must be non-negative'),
})

const deliveryNoteSchema = z.object({
  dn_number: z.string().min(1, 'DN number is required'),
  purchase_order_id: z.string().min(1, 'Purchase order is required'),
  delivery_date: z.string().min(1, 'Delivery date is required'),
  received_by: z.string().min(1, 'Received by is required'),
  notes: z.string().optional(),
  items: z.array(dnItemSchema).min(1, 'At least one item is required'),
})

type DeliveryNoteFormData = z.infer<typeof deliveryNoteSchema>

interface PurchaseOrder {
  id: string
  po_number: string
  project: { name: string }
  vendor: { name: string }
}

interface PoItem {
  id: string
  item_name: string
  description?: string
  quantity: number
  unit_price: number
}

export default function DeliveryNoteForm() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [poItems, setPoItems] = useState<PoItem[]>([])
  const [selectedPO, setSelectedPO] = useState<string>('')
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DeliveryNoteFormData>({
    resolver: zodResolver(deliveryNoteSchema),
    defaultValues: {
      items: [],
    },
  })


  useEffect(() => {
    fetchPurchaseOrders()
  }, [])

  useEffect(() => {
    if (selectedPO) {
      fetchPoItems(selectedPO)
    }
  }, [selectedPO])

  const fetchPurchaseOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        project:projects(name),
        vendor:vendors(name)
      `)
      .in('status', ['confirmed', 'sent'])
      .order('po_number')
    
    setPurchaseOrders((data as any) || [])
  }

  const fetchPoItems = async (poId: string) => {
    const { data } = await supabase
      .from('po_items')
      .select('*')
      .eq('purchase_order_id', poId)
    
    setPoItems(data || [])
    
    // Initialize items array with PO items
    const initialItems = (data || []).map(item => ({
      po_item_id: item.id,
      delivered_quantity: 0,
      daily_rate: 0,
    }))
    setValue('items', initialItems)
  }

  const handlePOChange = (poId: string) => {
    setSelectedPO(poId)
    setValue('purchase_order_id', poId)
  }

  const onSubmit = async (data: DeliveryNoteFormData) => {
    try {
      const { data: dnData, error: dnError } = await supabase
        .from('delivery_notes')
        .insert([{
          dn_number: data.dn_number,
          purchase_order_id: data.purchase_order_id,
          delivery_date: data.delivery_date,
          received_by: data.received_by,
          notes: data.notes,
        }])
        .select()
        .single()
      
      if (dnError) throw dnError
      
      const itemsWithDn = data.items
        .filter(item => item.delivered_quantity > 0)
        .map(item => ({
          delivery_note_id: dnData.id,
          po_item_id: item.po_item_id,
          delivered_quantity: item.delivered_quantity,
          daily_rate: item.daily_rate,
          status: 'delivered' as const,
        }))
      
      const { error: itemsError } = await supabase
        .from('dn_items')
        .insert(itemsWithDn)
      
      if (itemsError) throw itemsError
      
      alert('Delivery note created successfully!')
    } catch (error) {
      console.error('Error creating DN:', error)
      alert('Error creating delivery note')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Delivery Note</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dn_number">DN Number</Label>
              <Input
                id="dn_number"
                {...register('dn_number')}
                placeholder="Enter DN number"
              />
              {errors.dn_number && (
                <p className="text-sm text-red-500 mt-1">{errors.dn_number.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="delivery_date">Delivery Date</Label>
              <Input
                id="delivery_date"
                type="date"
                {...register('delivery_date')}
              />
              {errors.delivery_date && (
                <p className="text-sm text-red-500 mt-1">{errors.delivery_date.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="purchase_order_id">Purchase Order</Label>
            <select
              id="purchase_order_id"
              {...register('purchase_order_id')}
              onChange={(e) => handlePOChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Purchase Order</option>
              {purchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.po_number} - {po.vendor.name} ({po.project.name})
                </option>
              ))}
            </select>
            {errors.purchase_order_id && (
              <p className="text-sm text-red-500 mt-1">{errors.purchase_order_id.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="received_by">Received By</Label>
            <Input
              id="received_by"
              {...register('received_by')}
              placeholder="Enter name of person who received"
            />
            {errors.received_by && (
              <p className="text-sm text-red-500 mt-1">{errors.received_by.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Additional notes about delivery"
            />
          </div>

          {poItems.length > 0 && (
            <div>
              <Label>Delivery Items</Label>
              <div className="space-y-4 mt-2">
                {poItems.map((poItem, index) => (
                  <Card key={poItem.id} className="p-4">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-4">
                        <Label>Item</Label>
                        <div className="text-sm font-medium">{poItem.item_name}</div>
                        <div className="text-xs text-gray-500">{poItem.description}</div>
                      </div>

                      <div className="col-span-2">
                        <Label>PO Quantity</Label>
                        <div className="text-sm">{poItem.quantity}</div>
                      </div>

                      <div className="col-span-2">
                        <Label>Unit Price</Label>
                        <div className="text-sm">${poItem.unit_price}</div>
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor={`items.${index}.delivered_quantity`}>Delivered Qty</Label>
                        <Input
                          type="number"
                          {...register(`items.${index}.delivered_quantity`, { valueAsNumber: true })}
                          placeholder="0"
                          min="0"
                          max={poItem.quantity}
                        />
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor={`items.${index}.daily_rate`}>Daily Rate</Label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`items.${index}.daily_rate`, { valueAsNumber: true })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <input
                      type="hidden"
                      {...register(`items.${index}.po_item_id`)}
                      value={poItem.id}
                    />
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Button type="submit" disabled={isSubmitting || poItems.length === 0}>
            {isSubmitting ? 'Creating...' : 'Create Delivery Note'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
