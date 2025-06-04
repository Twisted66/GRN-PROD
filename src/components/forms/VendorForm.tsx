'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  contact_person: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  tax_id: z.string().optional(),
})

type VendorFormData = z.infer<typeof vendorSchema>

interface VendorFormProps {
  onSubmit: (data: VendorFormData) => Promise<void>
  initialData?: Partial<VendorFormData>
  isLoading?: boolean
}

export function VendorForm({ onSubmit, initialData, isLoading }: VendorFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: initialData,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Edit Vendor' : 'Create Vendor'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Vendor Name</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Enter vendor name"
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="contact_person">Contact Person</Label>
            <Input
              id="contact_person"
              {...register('contact_person')}
              placeholder="Enter contact person name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="Enter email address"
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              {...register('address')}
              placeholder="Enter vendor address"
            />
          </div>

          <div>
            <Label htmlFor="tax_id">Tax ID</Label>
            <Input
              id="tax_id"
              {...register('tax_id')}
              placeholder="Enter tax ID"
            />
          </div>

          <Button type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting ? 'Saving...' : 'Save Vendor'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
