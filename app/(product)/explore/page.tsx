import type { Metadata } from "next"
import { cookies } from "next/headers"
import { StudentWorkspacePage } from "@/components/student-workspace-page"
import { PublicExplore } from "@/components/landing/public-explore"
import { getPublicExplore } from "@/lib/public-explore"
import { privateRobots, publicPageMetadata } from "@/lib/seo"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from "@/lib/demo/access"

const description = "Browse clubs at the University of Virginia on OutClass. See what each club does and when applications open."

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const [params, jar] = await Promise.all([searchParams, cookies()])
  const account = jar.has(PLATFORM_VIEW_COOKIE) || jar.get(DEMO_COOKIE)?.value === "1" || jar.getAll().some(cookie => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
  // The unfiltered public list is indexable; searches and account views are not.
  const filtered = Object.keys(params).length > 0
  return { ...publicPageMetadata("Explore clubs · OutClass", description, "/explore"), ...(account || filtered ? { robots: privateRobots } : {}) }
}
export const maxDuration = 60

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <StudentWorkspacePage path="/explore" searchParams={searchParams} signedOut={async params => {
    const query = params.get("q") ?? "", category = params.get("category") ?? "all"
    const data = await getPublicExplore(query, category)
    return <PublicExplore {...data} query={query} />
  }} />
}
