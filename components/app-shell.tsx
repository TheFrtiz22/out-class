"use client"

import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import type { PersonalSection } from "@/lib/product-navigation"
import { useDemoMode } from "@/contexts/demo-context"
import { signInReturnPath, authEntryHref } from "@/lib/auth"
import { useAuth } from "@/contexts/auth-context"
import { loadedDemoStore } from "@/lib/demo/loader"
import { useState, useEffect, useMemo, useRef } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { type AppMode, type ViewId } from "@/lib/views"
import { ApplicationStateProvider, useSeedApplicationData } from "@/lib/application-state"
import { useInWorkspaceShell, useShellBindings } from "@/components/shell/workspace-shell-context"
import type { ReactNode } from "react"
import { AuthSessionBoundary } from "@/components/auth-session-boundary"
import { OutClassLoadingScreen } from "@/components/outclass-loading-screen"
import { WorkspaceLoading } from "@/components/workspace-loading"
import { LandingPageView } from "@/components/views/landing-page-view"
import { resolveStudentView, sectionForStudentView, canonicalStudentParams } from "@/lib/student-navigation"
import { STUDENT_HOME, studentPath, studentRouteForPath } from "@/lib/navigation"
import { FocusFrame } from "@/components/shell/focus-frame"
import { Button } from "@/components/ui/button"

const renderDestinationLoading = () => <OutClassLoadingScreen />

const OrganizationOwnershipRequests = dynamic(() => import("@/components/organization-ownership-requests").then(module => module.OrganizationOwnershipRequests), { loading: () => <WorkspaceLoading label="Checking organization invitations…" layout="feed" rows={2} /> })
const PersonalClubs = dynamic(() => import("@/components/personal-clubs").then(module => module.PersonalClubs), { loading: () => <WorkspaceLoading label="Loading your clubs…" layout="cards" /> })
const DemoClubSettings = dynamic(() => import("@/components/demo-workspace").then(module => module.DemoClubSettings), { loading: () => <WorkspaceLoading label="Loading club settings…" layout="form" /> })
const DemoInterviewSchedule = dynamic(() => import("@/components/demo-workspace").then(module => module.DemoInterviewSchedule), { loading: () => <WorkspaceLoading label="Loading interview schedule…" layout="calendar" /> })
const ClubWorkspaceSettings = dynamic(() => import("@/components/club-workspace-settings").then(module => module.ClubWorkspaceSettings), { loading: () => <WorkspaceLoading label="Loading club settings…" layout="form" /> })
const AuthView = dynamic(() => import("@/components/views/auth-view").then(module => module.AuthView), { loading: renderDestinationLoading })
const StudentDashboardView = dynamic(() => import("@/components/views/student-dashboard-view").then(module => module.StudentDashboardView), { loading: () => <WorkspaceLoading label="Loading your dashboard…" layout="workspace" /> })
const UnifiedStudentProfileView = dynamic(() => import("@/components/views/unified-student-profile-view").then(module => module.UnifiedStudentProfileView), { loading: () => <WorkspaceLoading label="Loading your profile…" layout="form" /> })
const InboxView = dynamic(() => import("@/components/views/inbox-view").then(module => module.InboxView), { loading: () => <WorkspaceLoading label="Loading your inbox…" layout="feed" /> })
const ExploreView = dynamic(() => import("@/components/views/explore-view").then(module => module.ExploreView), { loading: () => <WorkspaceLoading label="Loading clubs…" layout="cards" /> })
const CorkboardView = dynamic(() => import("@/components/views/corkboard-view").then(module => module.CorkboardView), { loading: () => <WorkspaceLoading label="Loading Corkboard…" layout="cards" /> })
const ApplicationTrackerView = dynamic(() => import("@/components/views/application-tracker-view").then(module => module.ApplicationTrackerView), { loading: () => <WorkspaceLoading label="Preparing your applications…" layout="applications" /> })
const CalendarView = dynamic(() => import("@/components/views/calendar-view").then(module => module.CalendarView), { loading: () => <WorkspaceLoading label="Loading your schedule…" layout="schedule" /> })
const LeaderDashboardView = dynamic(() => import("@/components/views/leader-dashboard-view").then(module => module.LeaderDashboardView), { loading: () => <WorkspaceLoading label="Loading recruitment workspace…" layout="applicants" /> })
const ScreeningDashboardView = dynamic(() => import("@/components/views/screening-dashboard-view").then(module => module.ScreeningDashboardView), { loading: () => <WorkspaceLoading label="Loading recruiting rules…" layout="form" /> })
const InterviewSchedulerView = dynamic(() => import("@/components/views/interview-scheduler-view").then(module => module.InterviewSchedulerView), { loading: () => <WorkspaceLoading label="Loading interview schedule…" layout="calendar" /> })
const InterviewWorkspaceView = dynamic(() => import("@/components/views/interview-workspace-view").then(module => module.InterviewWorkspaceView), { loading: () => <WorkspaceLoading label="Preparing interview workspace…" layout="interview" /> })
const StudentOnboardingWizard = dynamic(() => import("@/components/views/student-onboarding-wizard").then(module => module.StudentOnboardingWizard), { loading: renderDestinationLoading })

const adminViewIds: ViewId[] = [
  "leader-dashboard",
  "club-manager",
  "screening-dashboard",
  "interview-scheduler",
  "interview-workspace",
  "broadcast-messages",
]

/** Map URL error codes from OAuth / auth callback redirects to user-facing messages. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "uva_only": "Please sign in using your UVA email (@virginia.edu).",
  "auth-code-expired": "Your sign-in link has expired. Please try again.",
}

export type AppShellProps = { launchClubs?: import("@/lib/launch-clubs").LaunchClub[]; initialView?: ViewId; embedded?: boolean; initialSession?: any; initialData?: any; hasProfile?: boolean; initialAuthRole?: "student" | "leader" }

export function AppShell({ launchClubs = [], initialView = "landing", embedded = false, initialSession = null, initialData: realInitialData = null, hasProfile = false, initialAuthRole }: AppShellProps) {
  const demo = useDemoMode()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  // Personal workspace views have real paths (/home, /explore, …); the homepage only serves landing and sign-in.
  const searchKey = searchParams.toString()
  const pathRoute = useMemo(() => embedded ? null : studentRouteForPath(pathname, new URLSearchParams(searchKey)), [embedded, pathname, searchKey])
  const [personalSection, setPersonalSection] = useState<PersonalSection>(() => pathRoute?.section ?? canonicalStudentParams(new URLSearchParams(searchParams.toString()))?.section ?? "explore")
  const showLanding = !embedded && initialView === "landing" && !searchParams.has("workspace") && !searchParams.has("view") && !searchParams.has("demoClub") && !searchParams.has("next")
  const wantsStudent = !!pathRoute || searchParams.get("workspace") === "student"
  const { selectClub, user, isImpersonating } = useAuth()
  const initialData = demo.isDemoEnabled ? loadedDemoStore().demoDashboard() : realInitialData
  // ── Read auth error from URL query params (e.g. /?error=uva_only) ──
  const [authError, setAuthError] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const errorCode = params.get("error")
    if (errorCode && AUTH_ERROR_MESSAGES[errorCode]) {
      setAuthError(AUTH_ERROR_MESSAGES[errorCode])
      // Clean the URL so the error doesn't persist on refresh
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, "", cleanUrl)
    }
  }, [])

  const [view, setView] = useState<ViewId>(
    initialAuthRole ? "auth" : showLanding ? "landing" : demo.isDemoEnabled ? pathRoute ? pathRoute.view : (searchParams.has("demoClub") ? "explore" : !wantsStudent && demo.state?.perspective.role === "leader" ? "leader-dashboard" : "student-dashboard") : initialSession
      ? hasProfile
        ? pathRoute?.view ?? "student-dashboard"
        : "student-onboarding"
      : initialView
  )
  const [appMode, setAppMode] = useState<AppMode>(initialAuthRole ? initialAuthRole === "leader" ? "admin" : "student" : demo.isDemoEnabled ? (!wantsStudent && demo.state?.perspective.role === "leader" ? "admin" : "student") : adminViewIds.includes(initialView) ? "admin" : "student")
  function navigate(next: ViewId, section?: PersonalSection) {
    if (isImpersonating && next === "auth") return
    if (demo.isDemoEnabled && ["auth", "student-onboarding"].includes(next)) { demo.viewAs("student"); return }
    if (resolveStudentView(next)) {
      const nextSection = sectionForStudentView(next, section ?? (next === "calendar" ? personalSection : null))
      setPersonalSection(nextSection)
      const params = new URLSearchParams({ workspace: "student", view: next })
      if (!["explore", "corkboard"].includes(nextSection)) params.set("section", nextSection)
      const href = embedded ? `/preview?${params}` : studentPath(next, nextSection)
      // Already-open student workspaces share a persistent client shell. Native
      // history keeps URL/back navigation in sync without reloading homepage data.
      if (user && resolveStudentView(view)) window.history.pushState(null, "", href)
      else router.push(href)
    }
    setView(embedded && next === "landing" ? initialView : next)
  }

  // If an auth error was found in the URL, force the auth view so the user sees the message
  useEffect(() => {
    if (authError && !initialSession) {
      setView("auth")
    }
  }, [authError, initialSession])

  useEffect(() => {
    if (showLanding && !initialAuthRole) { setView("landing"); return }
    const route = canonicalStudentParams(new URLSearchParams(searchParams.toString()))
    if (route) {
      setView(route.view)
      setPersonalSection(route.section)
      if (route.params.toString() !== searchParams.toString()) router.replace(`${embedded ? "/preview" : "/"}?${route.params}`)
    }
  }, [searchParams, showLanding, embedded, router, initialAuthRole])

  // Back/forward between student paths, and direct entry to a specific path.
  // /home mirrors the old `/?workspace=student`: it does not skip onboarding.
  const syncedPath = useRef<string | null>(null)
  useEffect(() => {
    if (!pathRoute) return
    const key = `${pathname}?${searchKey}`
    const first = syncedPath.current === null
    if (syncedPath.current === key) return
    syncedPath.current = key
    setPersonalSection(pathRoute.section)
    if (!first || pathname !== STUDENT_HOME) setView(pathRoute.view)
  }, [pathRoute, pathname, searchKey])

  // Full-page steps hide the persistent shell's chrome (it stays mounted underneath).
  useShellBindings({ bare: true }, view === "student-onboarding" || view === "interview-workspace" || view === "auth" || view === "landing")

  function handleEnter(next: ViewId) {
    if (!adminViewIds.includes(next)) {
      try { sessionStorage.setItem("outclass-demo-student", "true") } catch { /* Demo remains usable without session storage. */ }
    }
    setAppMode(adminViewIds.includes(next) ? "admin" : "student")
    setView(next)
  }

    useEffect(() => {
    if (demo.isDemoEnabled && wantsStudent && demo.state?.perspective.role !== "student") demo.viewAs("student")
    else if (demo.isDemoEnabled && !wantsStudent && view === "leader-dashboard" && demo.state?.perspective.role === "leader") router.replace(clubWorkspaceHref(demo.state.perspective.clubId))
  }, [demo.isDemoEnabled, demo.state?.perspective.role, wantsStudent, view])

  function switchMode(mode: AppMode, clubId?: string) {
    if (mode === "admin" && clubId) { router.push(clubWorkspaceHref(clubId)); return }
    if (demo.isDemoEnabled) { demo.viewAs(mode === "admin" ? "leader" : "student", clubId); return }
    if (clubId) selectClub(clubId)
    setAppMode(mode)
    setView(mode === "admin" ? (user?.memberships.some(m => m.clubId === clubId && (m.isOwner || m.permissions.includes("applicants.identify") || m.permissions.includes("applications.review"))) ? "leader-dashboard" : "club-manager") : "student-dashboard")
  }

  if (view === "landing") {
    return (
      <LandingPageView
        launchClubs={launchClubs}
        onNavigateToApp={(role) => {
          setAppMode(role === "leader" ? "admin" : "student")
          setView("auth")
        }}
      />
    )
  }

  if (view === "auth" && isImpersonating) return <main className="p-8">Your administrator login is preserved. Exit impersonation above before changing authentication. <Button variant="link" className="h-auto px-0" onClick={() => setView("student-dashboard")}>Return to the user’s workspace</Button></main>

  if (view === "auth") {
    return <AuthView onCreateAccount={() => { window.location.href = authEntryHref("/signup", window.location.search) }} onEnter={handleEnter} onBack={() => setView("landing")} initialRole={appMode === "admin" ? "leader" : "student"} initialError={authError} />
  }

  if (view === "student-onboarding") {
    return (
      <StudentOnboardingWizard
        initialUser={initialSession}
        onBack={() => setView("landing")}
        onSignIn={() => setView("auth")}
        onComplete={() => {
          // Reload so the Server Component layout picks up the new session and fetches fresh data
          window.location.href = signInReturnPath(new URLSearchParams(window.location.search).get("next"))
        }}
      />
    )
  }


  return (
    <StudentState serverData={initialData} initialData={initialData ?? (initialSession ? { applications: [], attendances: [] } : null)} persistLocalState={!demo.isDemoEnabled && !initialSession && initialData == null}>
      {view === "interview-workspace" ? <FocusFrame task="Interview" width="full"><AuthSessionBoundary><InterviewWorkspaceView onExit={() => navigate("leader-dashboard")} /></AuthSessionBoundary></FocusFrame> : <DashboardLayout view={view} appMode={appMode} onNavigate={navigate} onModeChange={switchMode} personalSection={personalSection} onPersonalSection={setPersonalSection}>
            {view === "student-dashboard" && <><OrganizationOwnershipRequests enabled={!!initialSession && !demo.isDemoEnabled} /><StudentDashboardView onNavigate={navigate} initialData={initialData} authenticated={!!initialSession} /></>}
            {view === "student-profile" && <UnifiedStudentProfileView />}
            {view === "inbox" && <InboxView onNavigate={navigate} />}
            {view === "my-clubs" && <PersonalClubs section={personalSection} />}
            {view === "explore" && <ExploreView onNavigate={navigate} section={personalSection === "categories" ? "categories" : "explore"} />}
            {view === "corkboard" && <CorkboardView onNavigate={navigate} />}
            {/* One instance for both scopes: its stage control slides instead of remounting. */}
            {(view === "tracker" || view === "status") && <ApplicationTrackerView onNavigate={navigate} scope={view === "status" ? "status" : "all"} />}
            {view === "calendar" && <CalendarView onNavigate={navigate} />}
            {view === "leader-dashboard" && <LeaderDashboardView />}
            {view === "screening-dashboard" && <ScreeningDashboardView />}
            {view === "interview-scheduler" && (demo.isDemoEnabled ? <DemoInterviewSchedule onNavigate={navigate} /> : <InterviewSchedulerView onNavigate={navigate} />)}
            {view === "club-manager" && (demo.isDemoEnabled ? <DemoClubSettings /> : <ClubWorkspaceSettings />)}
      </DashboardLayout>}
    </StudentState>
  )
}

/** Inside `app/(workspace)` the shell owns the store, so the student app seeds it; elsewhere (`/`, `/preview`) it keeps its own. */
function StudentState({ serverData, initialData, persistLocalState, children }: { serverData: any; initialData: any; persistLocalState: boolean; children: ReactNode }) {
  // `serverData` is the page's server payload (stable identity), so the store is seeded once per page load.
  if (useInWorkspaceShell()) return <SeededState initialData={serverData}>{children}</SeededState>
  return <ApplicationStateProvider initialData={initialData} persistLocalState={persistLocalState}>{children}</ApplicationStateProvider>
}
function SeededState({ initialData, children }: { initialData: any; children: ReactNode }) {
  useSeedApplicationData(initialData)
  return children
}
