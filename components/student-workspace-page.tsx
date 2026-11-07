import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { unstable_cache } from "next/cache"
import { getSessionUser, requireAuth } from "@/utils/auth"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"
import { isUvaEmail } from "@/lib/auth"
import { getLaunchClubs } from "@/lib/launch-clubs"
import { getStudentDashboardData } from "@/actions/applications"
import { prisma } from "@/utils/prisma"
import { HomeEntry } from "@/components/home-entry"
import { studentRouteForPath } from "@/lib/navigation"

const getCachedLaunchClubs = unstable_cache(getLaunchClubs, ["public-launch-clubs"], { revalidate: 300 })
type SearchParams = Promise<Record<string, string | string[] | undefined>>

function query(params: Record<string, string | string[] | undefined>) {
  const result = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) result.append(key, item)
  return result
}

/**
 * Server entry for every personal-workspace path (/home, /explore, …). Same
 * identity, demo, platform-view-as and disabled-account rules the homepage
 * applied to `/?workspace=student…`; the view now comes from the path.
 */
export async function StudentWorkspacePage({ path, searchParams, signedOut }: { path: string; searchParams: SearchParams; signedOut?: (params: URLSearchParams) => ReactNode | Promise<ReactNode> }) {
  const params = query(await searchParams)
  const route = studentRouteForPath(path, params)
  if (!route) throw Error(`Not a student workspace path: ${path}`)
  const jar = await cookies()
  const { data: { user: login }, error: authError } = await getSessionUser()
  const user = jar.has(PLATFORM_VIEW_COOKIE) ? (await requireAuth()).user : !authError && login?.email_confirmed_at && login.email && isUvaEmail(login.email) ? login : null

  // Demo runs entirely in the browser with fictional data, as it does on the homepage.
  if (jar.get(DEMO_COOKIE)?.value === "1" && canAccessDemo(authError ? undefined : user?.email)) {
    return <HomeEntry launchClubs={await getCachedLaunchClubs()} initialView={route.view} />
  }
  // A path with a public signed-out view (Explore) renders it; every other path asks for sign-in.
  if (!user && signedOut) return signedOut(params)
  if (!user) redirect(`/login?next=${encodeURIComponent(params.size ? `${path}?${params}` : path)}`)

  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { disabledAt: true } })
  if (account?.disabledAt) return <main className="p-8">Your account is unavailable. Contact OutClass support.</main>
  let initialData = null
  try { initialData = await getStudentDashboardData() } catch (e) { console.error(e) }
  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
  return <HomeEntry launchClubs={await getCachedLaunchClubs()} initialView={route.view} initialSession={user} initialData={initialData} hasProfile={!!profile} />
}
