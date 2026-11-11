import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { unstable_cache } from "next/cache"
import { getSessionUser, requireAuth } from "@/utils/auth"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"
import { isUvaEmail } from "@/lib/auth"
import { getLaunchClubs } from "@/lib/launch-clubs"
import { getStudentDashboardData } from "@/actions/applications"
import { getClubDirectory } from "@/actions/club-directory"
import { prisma } from "@/utils/prisma"
import { AppShell, type StudentViews } from "@/components/app-shell"
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
 *
 * The app shell and the route's own view (`views`, imported by the page) are static client
 * imports, so the server HTML hydrates in place. Behind next/dynamic (HomeEntry, which keeps the
 * marketing homepage light) an update reaching the unhydrated boundary before its chunk arrives
 * makes React replace the painted page with the loading fallback.
 */
export async function StudentWorkspacePage({ path, searchParams, views }: { path: string; searchParams: SearchParams; views?: StudentViews }) {
  const params = query(await searchParams)
  const route = studentRouteForPath(path, params)
  if (!route) throw Error(`Not a student workspace path: ${path}`)
  const [jar, { data: { user: login }, error: authError }] = await Promise.all([cookies(), getSessionUser()])
  const user = jar.has(PLATFORM_VIEW_COOKIE) ? (await requireAuth()).user : !authError && login?.email_confirmed_at && login.email && isUvaEmail(login.email) ? login : null

  // Demo runs entirely in the browser with fictional data, as it does on the homepage.
  if (jar.get(DEMO_COOKIE)?.value === "1" && canAccessDemo(authError ? undefined : user?.email)) {
    return <AppShell launchClubs={await getCachedLaunchClubs()} initialView={route.view} views={views} />
  }
  if (!user) redirect(`/login?next=${encodeURIComponent(params.size ? `${path}?${params}` : path)}`)

  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { disabledAt: true } })
  if (account?.disabledAt) return <main className="p-8">Your account is unavailable. Contact OutClass support.</main>
  // After the identity and disabled-account gates these reads are independent. Explore also gets the
  // public directory (the same loader /api/workspace serves) so its first paint is not an empty list.
  const [initialData, profile, launchClubs, initialDirectory] = await Promise.all([
    getStudentDashboardData().catch(e => { console.error(e); return null }),
    prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    getCachedLaunchClubs(),
    route.view === "explore" ? getClubDirectory() : undefined,
  ])
  return <AppShell launchClubs={launchClubs} initialView={route.view} initialSession={user} initialData={initialData} hasProfile={!!profile} initialDirectory={initialDirectory} serverNow={Date.now()} views={views} />
}
