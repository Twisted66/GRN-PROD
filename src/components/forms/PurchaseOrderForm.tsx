'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileUpload } from '@/components/ui/file-upload'
import { Plus, Trash2 } from 'lucide-react'

const poItemSchema = z.object({
  item_name: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_price: z.number().min(0, 'Unit price must be non-negative'),
})

const purchaseOrderSchema = z.object({
  po_number: z.string().min(1, 'PO number is required'),
  project_id: z.string().min(1, 'Project is required'),
  vendor_id: z.string().min(1, 'Vendor is required'),
  status: z.enum(['draft', 'sent', 'confirmed', 'completed', 'cancelled']),
  po_date: z.string().min(1, 'PO date is required'),
  currency: z.string().default('USD'),
  items: z.array(poItemSchema).min(1, 'At least one item is required'),
})

type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>

interface Project {
  id: string
  name: string
}

interface Vendor {
  id: string
  name: string
}

export default function PurchaseOrderForm() {
  const [projects, setProjects] = useState<Project[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const supabase = createClient()

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      status: 'draft',
      currency: 'USD',
      items: [{ item_name: '', description: '', quantity: 1, unit_price: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const watchedItems = watch('items')

  useEffect(() => {
    fetchProjects()
    fetchVendors()
  }, [])

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
    setProjects(data || [])
  }

  const fetchVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('id, name')
      .order('name')
    setVendors(data || [])
  }

  const handleFileUpload = async (file: File) => {
    setSelectedFile(file)
    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/.netlify/functions/upload-po-document', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) throw new Error('Upload failed')
      
      const result = await response.json()
      setUploadedFileUrl(result.url)
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const calculateTotal = () => {
    return watchedItems.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unit_price) || 0
      return sum + (quantity * unitPrice)
    }, 0)
  }

  const onSubmit = async (data: PurchaseOrderFormData) => {
    try {
      const totalAmount = calculateTotal()
      
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
          ...data,
          total_amount: totalAmount,
          document_url: uploadedFileUrl,
        }])
        .select()
        .single()
      
      if (poError) throw poError
      
      const itemsWithPo = data.items.map(item => ({
        ...item,
        purchase_order_id: poData.id,
        line_total: item.quantity * item.unit_price,
      }))
      
      const { error: itemsError } = await supabase
        .from('po_items')
        .insert(itemsWithPo)
      
      if (itemsError) throw itemsError
      
      alert('Purchase order created successfully!')
    } catch (error) {
      console.error('Error creating PO:', error)
      alert('Error creating purchase order')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Purchase Order</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="po_number">PO Number</Label>
                <Input
                  id="po_number"
                  {...register('po_number')}
                  placeholder="Enter PO number"
                />
                {errors.po_number && (
                  <p className="text-sm text-red-500 mt-1">{errors.po_number.message}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="po_date">PO Date</Label>
                <Input
                  id="po_date"
                  type="date"
                  {...register('po_date')}
                />
                {errors.po_date && (
                  <p className="text-sm text-red-500 mt-1">{errors.po_date.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="project_id">Project</Label>
                <select
                  id="project_id"
                  {...register('project_id')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select Project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {errors.project_id && (
                  <p className="text-sm text-red-500 mt-1">{errors.project_id.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="vendor_id">Vendor</Label>
                <select
                  id="vendor_id"
                  {...register('vendor_id')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
                {errors.vendor_id && (
                  <p className="text-sm text-red-500 mt-1">{errors.vendor_id.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                {...register('status')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <Label>Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ item_name: '', description: '', quantity: 1, unit_price: 0 })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {fields.map((field, index) => (
                <Card key={field.id} className="p-4">
                  <div className="grid grid-cols-12 gap-4 items-start">
                    <div className="col-span-3">
                      <Label htmlFor={`items.${index}.item_name`}>Item Name</Label>
                      <Input
                        {...register(`items.${index}.item_name`)}
                        placeholder="Item name"
                      />
                      {errors.items?.[index]?.item_name && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.items[index]?.item_name?.message}
                        </p>
                      )}
                    </div>

                    <div className="col-span-3">
                      <Label htmlFor={`items.${index}.description`}>Description</Label>
                      <Input
                        {...register(`items.${index}.description`)}
                        placeholder="Description"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor={`items.${index}.quantity`}>Quantity</Label>
                      <Input
                        type="number"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        placeholder="Qty"
                      />
                      {errors.items?.[index]?.quantity && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.items[index]?.quantity?.message}
                        </p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor={`items.${index}.unit_price`}>Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                        placeholder="Price"
                      />
                      {errors.items?.[index]?.unit_price && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.items[index]?.unit_price?.message}
                        </p>
                      )}
                    </div>

                    <div className="col-span-1">
                      <Label>Total</Label>
                      <div className="h-10 flex items-center px-3 text-sm font-medium">
                        ${((watchedItems[index]?.quantity || 0) * (watchedItems[index]?.unit_price || 0)).toFixed(2)}
                      </div>
                    </div>

                    <div className="col-span-1">
                      <Label>&nbsp;</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              <div className="flex justify-end mt-4">
                <div className="text-lg font-semibold">
                  Total: ${calculateTotal().toFixed(2)}
                </div>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <FileUpload
        onFileSelect={handleFileUpload}
        isLoading={isUploading}
        accept=".pdf,.jpg,.jpeg,.png"
      />
    </div>
  )
}
