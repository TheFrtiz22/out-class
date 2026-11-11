import type { Metadata } from "next"
import { StudentWorkspacePage } from "@/components/student-workspace-page"
import { CalendarView } from "@/components/views/calendar-view"
import { privateRobots } from "@/lib/seo"

export const metadata: Metadata = { title: "Calendar", robots: privateRobots }
export const maxDuration = 60

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <StudentWorkspacePage path="/calendar" searchParams={searchParams} views={{ CalendarView }} />
}
