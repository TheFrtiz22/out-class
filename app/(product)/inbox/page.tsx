import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { StudentWorkspacePage } from "@/components/student-workspace-page"
import { privateRobots } from "@/lib/seo"

export const metadata: Metadata = { title: "Inbox", robots: privateRobots }
export const maxDuration = 60

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The Inbox's Email preferences tab moved to Settings → Notifications; old links still land there.
  if ((await searchParams).tab === "preferences") redirect("/settings/notifications")
  return <StudentWorkspacePage path="/inbox" searchParams={searchParams} />
}
