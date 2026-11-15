import type { Metadata } from "next"
import { StudentWorkspacePage } from "@/components/student-workspace-page"
import { UnifiedStudentProfileView } from "@/components/views/unified-student-profile-view"
import { privateRobots } from "@/lib/seo"

export const metadata: Metadata = { title: "Profile", robots: privateRobots }
export const maxDuration = 60

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <StudentWorkspacePage path="/profile" searchParams={searchParams} views={{ UnifiedStudentProfileView }} />
}
