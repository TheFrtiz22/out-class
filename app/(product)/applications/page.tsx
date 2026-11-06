import type { Metadata } from "next"
import { StudentWorkspacePage } from "@/components/student-workspace-page"
import { privateRobots } from "@/lib/seo"

export const metadata: Metadata = { robots: privateRobots }
export const maxDuration = 60

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <StudentWorkspacePage path="/applications" searchParams={searchParams} />
}
