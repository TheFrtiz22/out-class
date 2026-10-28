import { adminPageLoad } from "@/utils/admin-page"
import { AdminRecovery } from "@/components/admin/admin-recovery"
import { requirePlatformAdmin } from "@/utils/platform-admin"
import { PageHeader } from "@/components/product/page-header"
import { SchoolRequestReview } from "@/components/admin/school-request-review"

export default async function SchoolRequestsPage() {
  const result = await adminPageLoad("/platform/school-requests", requirePlatformAdmin)
  if (result.supportCode) return <AdminRecovery supportCode={result.supportCode} />
  return <section className="mx-auto max-w-4xl oc-workspace-stack oc-admin-workspace"><PageHeader eyebrow="OutClass · Administration" title="School Requests" description="Review interest from students, club leaders, and university administrators." /><SchoolRequestReview /></section>
}
