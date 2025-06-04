'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import DeliveryNoteForm from '@/components/forms/DeliveryNoteForm'

export default function CreateDeliveryNotePage() {
  return (
    <DashboardLayout>
      <div className="px-4 py-6 sm:px-0">
        <DeliveryNoteForm />
      </div>
    </DashboardLayout>
  )
}
