'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import VendorsDataTable from '@/components/data-tables/VendorsDataTable'

export default function VendorsPage() {
  return (
    <DashboardLayout>
      <div className="px-4 py-6 sm:px-0">
        <VendorsDataTable />
      </div>
    </DashboardLayout>
  )
}
