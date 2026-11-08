import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { StudentWorkspacePage } from "@/components/student-workspace-page"
import { privateRobots } from "@/lib/seo"
import { Suspense } from "react"
import { WorkspaceLoading } from "@/components/workspace-loading"

export const metadata: Metadata = { title: "Inbox", robots: privateRobots }
export const maxDuration = 60

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The Inbox's Email preferences tab moved to Settings → Notifications; old links still land there.
  if ((await searchParams).tab === "preferences") redirect("/settings/notifications")
  // No route loading.tsx: it would stream the persistent shell before this redirect (a second document load
  // instead of a 307). The placeholder streams from here, after the redirect check.
  return <Suspense fallback={<WorkspaceLoading label="Loading your inbox…" layout="feed" rows={3} />}><StudentWorkspacePage path="/inbox" searchParams={searchParams} /></Suspense>
}
