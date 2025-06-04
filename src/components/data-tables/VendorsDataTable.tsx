'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { VendorForm } from '@/components/forms/VendorForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'

interface Vendor {
  id: string
  name: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  tax_id?: string
  created_at: string
}

export default function VendorsDataTable() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchVendors()
  }, [])

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error('Error fetching vendors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateVendor = async (formData: any) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .insert([formData])
      
      if (error) throw error
      
      setIsDialogOpen(false)
      fetchVendors()
    } catch (error) {
      console.error('Error creating vendor:', error)
    }
  }

  const handleUpdateVendor = async (formData: any) => {
    if (!selectedVendor) return
    
    try {
      const { error } = await supabase
        .from('vendors')
        .update(formData)
        .eq('id', selectedVendor.id)
      
      if (error) throw error
      
      setIsDialogOpen(false)
      setSelectedVendor(null)
      fetchVendors()
    } catch (error) {
      console.error('Error updating vendor:', error)
    }
  }

  const handleDeleteVendor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return
    
    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      fetchVendors()
    } catch (error) {
      console.error('Error deleting vendor:', error)
    }
  }

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div>Loading...</div>

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Vendors</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setSelectedVendor(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <VendorForm
                onSubmit={selectedVendor ? handleUpdateVendor : handleCreateVendor}
                initialData={selectedVendor || undefined}
              />
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4" />
          <Input
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Tax ID</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVendors.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell className="font-medium">{vendor.name}</TableCell>
                <TableCell>{vendor.contact_person || '-'}</TableCell>
                <TableCell>{vendor.email || '-'}</TableCell>
                <TableCell>{vendor.phone || '-'}</TableCell>
                <TableCell>{vendor.tax_id || '-'}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedVendor(vendor)
                        setIsDialogOpen(true)
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteVendor(vendor.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
