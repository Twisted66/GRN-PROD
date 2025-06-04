'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

const returnItemSchema = z.object({
  dn_item_id: z.string().min(1, 'DN item is required'),
  return_quantity: z.number().min(1, 'Return quantity must be at least 1'),
  return_date: z.string().min(1, 'Return date is required'),
})

const returnSchema = z.object({
  items: z.array(returnItemSchema).min(1, 'At least one item is required'),
})

type ReturnFormData = z.infer<typeof returnSchema>

interface DnItem {
  id: string
  delivered_quantity: number
  returned_quantity: number
  status: string
  daily_rate: number
  po_item: {
    item_name: string
    description?: string
  }
  delivery_note: {
    dn_number: string
    delivery_date: string
    purchase_order: {
      po_number: string
      project: { name: string }
      vendor: { name: string }
    }
  }
}

export default function ReturnForm() {
  const [dnItems, setDnItems] = useState<DnItem[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReturnFormData>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      items: [],
    },
  })

  useEffect(() => {
    fetchDeliveredItems()
  }, [])

  const fetchDeliveredItems = async () => {
    try {
      const { data, error } = await supabase
        .from('dn_items')
        .select(`
          id,
          delivered_quantity,
          returned_quantity,
          status,
          daily_rate,
          po_item:po_items(
            item_name,
            description
          ),
          delivery_note:delivery_notes(
            dn_number,
            delivery_date,
            purchase_order:purchase_orders(
              po_number,
              project:projects(name),
              vendor:vendors(name)
            )
          )
        `)
        .in('status', ['delivered', 'partial_return'])
        .order('delivery_note(delivery_date)', { ascending: false })

      if (error) throw error
      setDnItems(data || [])
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleItemSelect = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId])
      const currentItems = watch('items')
      setValue('items', [
        ...currentItems,
        {
          dn_item_id: itemId,
          return_quantity: 1,
          return_date: format(new Date(), 'yyyy-MM-dd'),
        },
      ])
    } else {
      setSelectedItems(selectedItems.filter(id => id !== itemId))
      const currentItems = watch('items')
      setValue('items', currentItems.filter(item => item.dn_item_id !== itemId))
    }
  }

  const onSubmit = async (data: ReturnFormData) => {
    try {
      const response = await fetch('/.netlify/functions/process-return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnItems: data.items }),
      })

      if (!response.ok) throw new Error('Return processing failed')

      const result = await response.json()
      alert('Items returned successfully!')
      
      // Reset form and refresh data
      setSelectedItems([])
      setValue('items', [])
      fetchDeliveredItems()
    } catch (error) {
      console.error('Error processing returns:', error)
      alert('Error processing returns')
    }
  }

  const getAvailableQuantity = (item: DnItem) => {
    return item.delivered_quantity - item.returned_quantity
  }

  const calculateDaysOnRent = (deliveryDate: string) => {
    const delivery = new Date(deliveryDate)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - delivery.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  if (loading) return <div>Loading...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Process Returns</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label>Available Items for Return</Label>
            <div className="space-y-4 mt-4">
              {dnItems.map((item, index) => {
                const availableQty = getAvailableQuantity(item)
                const daysOnRent = calculateDaysOnRent(item.delivery_note.delivery_date)
                const isSelected = selectedItems.includes(item.id)
                const selectedIndex = watch('items').findIndex(i => i.dn_item_id === item.id)

                return (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-start space-x-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleItemSelect(item.id, e.target.checked)}
                        className="mt-1"
                      />
                      
                      <div className="flex-1 grid grid-cols-12 gap-4">
                        <div className="col-span-3">
                          <div className="text-sm font-medium">{item.po_item.item_name}</div>
                          <div className="text-xs text-gray-500">{item.po_item.description}</div>
                          <div className="text-xs text-blue-600">
                            {item.delivery_note.purchase_order.po_number}
                          </div>
                        </div>

                        <div className="col-span-2">
                          <Label className="text-xs">Project/Vendor</Label>
                          <div className="text-sm">{item.delivery_note.purchase_order.project.name}</div>
                          <div className="text-xs text-gray-500">
                            {item.delivery_note.purchase_order.vendor.name}
                          </div>
                        </div>

                        <div className="col-span-2">
                          <Label className="text-xs">Delivery Info</Label>
                          <div className="text-sm">{item.delivery_note.dn_number}</div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(item.delivery_note.delivery_date), 'MMM dd, yyyy')}
                          </div>
                        </div>

                        <div className="col-span-1">
                          <Label className="text-xs">Available</Label>
                          <div className="text-sm font-medium">{availableQty}</div>
                        </div>

                        <div className="col-span-1">
                          <Label className="text-xs">Days on Rent</Label>
                          <div className="text-sm">{daysOnRent}</div>
                        </div>

                        <div className="col-span-1">
                          <Label className="text-xs">Daily Rate</Label>
                          <div className="text-sm">${item.daily_rate}</div>
                        </div>

                        {isSelected && selectedIndex >= 0 && (
                          <>
                            <div className="col-span-1">
                              <Label htmlFor={`items.${selectedIndex}.return_quantity`} className="text-xs">
                                Return Qty
                              </Label>
                              <Input
                                type="number"
                                {...register(`items.${selectedIndex}.return_quantity`, { valueAsNumber: true })}
                                min="1"
                                max={availableQty}
                                className="h-8"
                              />
                            </div>

                            <div className="col-span-1">
                              <Label htmlFor={`items.${selectedIndex}.return_date`} className="text-xs">
                                Return Date
                              </Label>
                              <Input
                                type="date"
                                {...register(`items.${selectedIndex}.return_date`)}
                                className="h-8"
                              />
                            </div>

                            <input
                              type="hidden"
                              {...register(`items.${selectedIndex}.dn_item_id`)}
                              value={item.id}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          {selectedItems.length > 0 && (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processing Returns...' : `Process ${selectedItems.length} Return(s)`}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
