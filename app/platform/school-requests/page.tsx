import { redirect } from "next/navigation"
import { requirePlatformAdmin } from "@/utils/platform-admin"
import { PageHeader } from "@/components/product/page-header"
import { SchoolRequestReview } from "@/components/admin/school-request-review"

export default async function SchoolRequestsPage() {
  try { await requirePlatformAdmin() } catch { redirect("/platform/login") }
  return <main className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8"><PageHeader eyebrow="OutClass · Administration" title="School Requests" description="Review interest from students, club leaders, and university administrators." /><SchoolRequestReview /></main>
}
