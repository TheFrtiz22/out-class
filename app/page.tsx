import { requireAuth } from "@/utils/auth"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { getLaunchClubs } from "@/lib/launch-clubs"
import { safeReturnPath, isUvaEmail } from "@/lib/auth"
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"
import { HomeEntry } from "@/components/home-entry"
import { getStudentDashboardData } from "@/actions/applications"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { prisma } from "@/utils/prisma"
import type { Metadata } from "next"
import { unstable_cache } from "next/cache"
import { SITE_TITLE, SITE_DESCRIPTION, publicPageMetadata, privateRobots, privateHomepageParams, websiteStructuredData } from "@/lib/seo"

const getCachedLaunchClubs = unstable_cache(getLaunchClubs, ["public-launch-clubs"], { revalidate: 300 })

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams
  const jar = await cookies()
  const accountPage = privateHomepageParams.some(key => params[key] !== undefined) ||
    jar.has(PLATFORM_VIEW_COOKIE) || jar.get(DEMO_COOKIE)?.value === "1" ||
    jar.getAll().some(cookie => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
  return { ...publicPageMetadata(SITE_TITLE, SITE_DESCRIPTION, "/"), ...(accountPage ? { robots: privateRobots } : {}) }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeReturnPath((await searchParams).next)
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const { data: { user: login }, error: authError } = await supabase.auth.getUser()
  const user = cookieStore.has(PLATFORM_VIEW_COOKIE) ? (await requireAuth()).user : !authError && login?.email_confirmed_at && login.email && isUvaEmail(login.email) ? login : null

  if (cookieStore.get(DEMO_COOKIE)?.value === "1" && canAccessDemo(authError ? undefined : user?.email)) return <HomeEntry launchClubs={await getCachedLaunchClubs()} initialView="landing" />

  let initialData = null
  let hasProfile = false
  if (user) {
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { disabledAt: true } })
    if (account?.disabledAt) return <main className="p-8">Your account is unavailable. Contact OutClass support.</main>
    try {
      initialData = await getStudentDashboardData()
    } catch (e) {
      console.error(e)
    }
    // Check if the user has completed onboarding (has a StudentProfile)
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    hasProfile = !!profile
  }

  const launchClubs = await getCachedLaunchClubs()
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData).replace(/</g, "\\u003c") }} />
    <HomeEntry launchClubs={launchClubs} initialView={!user && next !== "/" ? "auth" : "landing"} initialSession={user} initialData={initialData} hasProfile={hasProfile} />
  </>
}
