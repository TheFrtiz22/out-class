import { adminPageLoad } from "@/utils/admin-page"
import { AdminRecovery } from "@/components/admin/admin-recovery"
import { requirePlatformAdmin } from "@/utils/platform-admin"
import { PageHeader } from "@/components/product/page-header"
import { SchoolRequestReview } from "@/components/admin/school-request-review"

export default async function SchoolRequestsPage() {
  const result = await adminPageLoad("/platform/school-requests", requirePlatformAdmin)
  if (result.supportCode) return <AdminRecovery supportCode={result.supportCode} />
  return <main className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8"><PageHeader eyebrow="OutClass · Administration" title="School Requests" description="Review interest from students, club leaders, and university administrators." /><SchoolRequestReview /></main>
}
