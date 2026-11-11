import type { Metadata } from "next"
import { StudentWorkspacePage } from "@/components/student-workspace-page"
import { privateRobots } from "@/lib/seo"
import { Suspense } from "react"
import { WorkspaceLoading } from "@/components/workspace-loading"

export const metadata: Metadata = { title: "Inbox", robots: privateRobots }
export const maxDuration = 60

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Notification settings open here, in a sheet from the Inbox header (`?tab=preferences`, which emails link to).
  // No route loading.tsx: the placeholder streams from here, like the other workspace pages.
  return <Suspense fallback={<WorkspaceLoading label="Loading your inbox…" layout="feed" rows={3} />}><StudentWorkspacePage path="/inbox" searchParams={searchParams} /></Suspense>
}
