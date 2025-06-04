'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import PurchaseOrderForm from '@/components/forms/PurchaseOrderForm'

export default function CreatePurchaseOrderPage() {
  return (
    <DashboardLayout>
      <div className="px-4 py-6 sm:px-0">
        <PurchaseOrderForm />
      </div>
    </DashboardLayout>
  )
}
