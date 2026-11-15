import type { Metadata } from "next"
import { StudentWorkspacePage } from "@/components/student-workspace-page"
import { PersonalClubs } from "@/components/personal-clubs"
import { privateRobots } from "@/lib/seo"
import { Suspense } from "react"
import { WorkspaceLoading } from "@/components/workspace-loading"

export const metadata: Metadata = { title: "My Clubs", robots: privateRobots }
export const maxDuration = 60

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The placeholder streams from the page, not a route loading.tsx, so the legacy /clubs/… redirects below stay real 307s.
  return <Suspense fallback={<WorkspaceLoading label="Loading your clubs…" layout="cards" rows={3} />}><StudentWorkspacePage path="/clubs" searchParams={searchParams} views={{ PersonalClubs }} /></Suspense>
}
