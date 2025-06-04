'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import ProjectsDataTable from '@/components/data-tables/ProjectsDataTable'

export default function ProjectsPage() {
  return (
    <DashboardLayout>
      <div className="px-4 py-6 sm:px-0">
        <ProjectsDataTable />
      </div>
    </DashboardLayout>
  )
}
