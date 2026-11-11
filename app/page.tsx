import { requireAuth } from "@/utils/auth"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { getLaunchClubs } from "@/lib/launch-clubs"
import { safeReturnPath, isUvaEmail } from "@/lib/auth"
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"
import { HomeEntry } from "@/components/home-entry"
import { STUDENT_HOME, isLeaderWorkspaceView, leaderWorkspaceHref, legacyStudentRedirect } from "@/lib/navigation"
import { hasWorkspace } from "@/lib/permissions"
import { getStudentDashboardData } from "@/actions/applications"
import { getSessionUser } from "@/utils/auth"
import { cookies } from "next/headers"
import { prisma } from "@/utils/prisma"
import type { Metadata } from "next"
import { unstable_cache } from "next/cache"
import { redirect } from "next/navigation"
import { SITE_TITLE, SITE_DESCRIPTION, publicPageMetadata, privateRobots, privateHomepageParams, websiteStructuredData } from "@/lib/seo"
import { initialLandingAudience, landingAudienceBootScript, LANDING_AUDIENCE_PREFERENCE } from "@/lib/landing-audience"

const getCachedLaunchClubs = unstable_cache(getLaunchClubs, ["public-launch-clubs"], { revalidate: 300 })

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams
  const jar = await cookies()
  const accountPage = privateHomepageParams.some(key => params[key] !== undefined) ||
    jar.has(PLATFORM_VIEW_COOKIE) || jar.get(DEMO_COOKIE)?.value === "1" ||
    jar.getAll().some(cookie => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
  return { ...publicPageMetadata(SITE_TITLE, SITE_DESCRIPTION, "/"), ...(accountPage ? { robots: privateRobots } : {}) }
}

export const maxDuration = 60

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  // Keep existing signup bookmarks while moving public account creation to one route.
  if (params.signup === "student") {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (key === "signup") return
      if (Array.isArray(value)) value.forEach(item => query.append(key, item))
      else if (value !== undefined) query.set(key, value)
    })
    redirect(`/signup${query.size ? `?${query}` : ""}`)
  }
  // Old student workspace URLs (middleware normally redirects these first; see middleware.ts).
  const legacyQuery = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) legacyQuery.append(key, item) })
  const legacyDestination = legacyStudentRedirect(legacyQuery)
  if (legacyDestination) redirect(legacyDestination)
  const next = safeReturnPath(typeof params.next === "string" ? params.next : undefined)
  // Independent request reads: the cookie jar and the (per-request cached) session lookup.
  const [cookieStore, { data: { user: login }, error: authError }] = await Promise.all([cookies(), getSessionUser()])
  const user = cookieStore.has(PLATFORM_VIEW_COOKIE) ? (await requireAuth()).user : !authError && login?.email_confirmed_at && login.email && isUvaEmail(login.email) ? login : null

  if (cookieStore.get(DEMO_COOKIE)?.value === "1" && canAccessDemo(authError ? undefined : user?.email)) return <HomeEntry initialLandingAudience={initialLandingAudience(params.audience, cookieStore.get(LANDING_AUDIENCE_PREFERENCE)?.value)} launchClubs={await getCachedLaunchClubs()} initialView="landing" />

  // Direct workspace URLs must not open a sample application for signed-out visitors.
  if (!user && ["workspace", "view", "demoClub"].some(key => params[key] !== undefined)) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach(item => query.append(key, item))
      else if (value !== undefined) query.set(key, value)
    })
    redirect(`/login?next=${encodeURIComponent(`/?${query}`)}`)
  }

  let hasProfile = false
  if (user) {
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { disabledAt: true } })
    if (account?.disabledAt) return <main className="p-8">Your account is unavailable. Contact OutClass support.</main>
    // Old leader views on the homepage open the matching club workspace section. The club is the
    // first active, unsuspended membership with workspace access (same rule as sign-in); without
    // one the visitor gets Home, as the student view replaced these before.
    const requestedView = typeof params.view === "string" ? params.view : null
    if (isLeaderWorkspaceView(requestedView)) {
      const leader = await prisma.user.findUnique({ where: { id: user.id }, select: { memberships: { where: { status: "ACTIVE", club: { suspendedAt: null } }, orderBy: { clubId: "asc" }, select: { clubId: true, status: true, isOwner: true, permissions: true, interviewOffices: true } } } })
      const club = leader?.memberships.find(hasWorkspace)
      const focus = { applicantId: typeof params.applicantId === "string" ? params.applicantId : null, roundId: typeof params.roundId === "string" ? params.roundId : null }
      redirect(club ? leaderWorkspaceHref(requestedView, club.clubId, focus) : STUDENT_HOME)
    }
    // Check if the user has completed onboarding (has a StudentProfile)
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    hasProfile = !!profile
    // Signed-in visitors skip the marketing page (after the disabled check, before any dashboard
    // read). Without a profile, `/?next=…` is the onboarding hand-off (requireCompletedStudentProfile):
    // stay here so onboarding runs, then continue to `next`; redirecting would loop. Leader and
    // demo entry URLs keep their own handling; old student URLs were already redirected.
    if (!["workspace", "view", "demoClub", "error"].some(key => params[key] !== undefined) && (hasProfile || next === "/")) redirect(next !== "/" ? next : STUDENT_HOME)
  }

  // After every auth, disabled-account and redirect check: the dashboard and the public launch-club
  // list do not depend on each other, so read them together. A dashboard failure still renders the page.
  const [initialData, launchClubs] = await Promise.all([
    user ? getStudentDashboardData().catch(e => { console.error(e); return null }) : null,
    getCachedLaunchClubs(),
  ])
  const landingAudience = initialLandingAudience(params.audience, cookieStore.get(LANDING_AUDIENCE_PREFERENCE)?.value)
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData).replace(/</g, "\\u003c") }} />
    <style id="oc-landing-audience-gate" />
    <script dangerouslySetInnerHTML={{ __html: landingAudienceBootScript }} />
    <HomeEntry initialLandingAudience={landingAudience} launchClubs={launchClubs} initialView={!user && next !== "/" ? "auth" : "landing"} initialSession={user} initialData={initialData} hasProfile={hasProfile} />
  </>
}
