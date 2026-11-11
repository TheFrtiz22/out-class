import type { Metadata } from "next"
import { StudentWorkspacePage } from "@/components/student-workspace-page"
import { ExploreView } from "@/components/views/explore-view"
import { privateRobots } from "@/lib/seo"

export const metadata: Metadata = { title: "Explore", robots: privateRobots }
export const maxDuration = 60

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <StudentWorkspacePage path="/explore/categories" searchParams={searchParams} views={{ ExploreView }} />
}
