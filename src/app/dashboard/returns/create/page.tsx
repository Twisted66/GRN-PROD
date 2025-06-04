'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import ReturnForm from '@/components/forms/ReturnForm'

export default function CreateReturnPage() {
  return (
    <DashboardLayout>
      <div className="px-4 py-6 sm:px-0">
        <ReturnForm />
      </div>
    </DashboardLayout>
  )
}
