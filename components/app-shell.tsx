"use client"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
const OrganizationOwnershipRequests = dynamic(() => import("@/components/organization-ownership-requests").then(module => module.OrganizationOwnershipRequests))
import { clubWorkspaceHref } from "@/lib/club-workspace"

const PersonalClubs = dynamic(() => import("@/components/personal-clubs").then(module => module.PersonalClubs))
import type { PersonalSection } from "@/lib/product-navigation"
const DemoClubSettings = dynamic(() => import("@/components/demo-workspace").then(module => module.DemoClubSettings))
const DemoInterviewSchedule = dynamic(() => import("@/components/demo-workspace").then(module => module.DemoInterviewSchedule))
import { useDemoMode } from "@/contexts/demo-context"
import { signInReturnPath } from "@/lib/auth"
import { useAuth } from "@/contexts/auth-context"
const ClubWorkspaceSettings = dynamic(() => import("@/components/club-workspace-settings").then(module => module.ClubWorkspaceSettings))
import { demoDashboard } from "@/lib/demo/store"
import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { type AppMode, type ViewId } from "@/lib/views"
import { ApplicationStateProvider } from "@/lib/application-state"

import { LandingPageView } from "@/components/views/landing-page-view"
const AuthView = dynamic(() => import("@/components/views/auth-view").then(module => module.AuthView))
const StudentDashboardView = dynamic(() => import("@/components/views/student-dashboard-view").then(module => module.StudentDashboardView))
const UnifiedStudentProfileView = dynamic(() => import("@/components/views/unified-student-profile-view").then(module => module.UnifiedStudentProfileView))
const InboxView = dynamic(() => import("@/components/views/inbox-view").then(module => module.InboxView))
const ExploreView = dynamic(() => import("@/components/views/explore-view").then(module => module.ExploreView))
const CorkboardView = dynamic(() => import("@/components/views/corkboard-view").then(module => module.CorkboardView))
import { resolveStudentView, sectionForStudentView, canonicalStudentParams } from "@/lib/student-navigation"
const ApplicationTrackerView = dynamic(() => import("@/components/views/application-tracker-view").then(module => module.ApplicationTrackerView))
const CalendarView = dynamic(() => import("@/components/views/calendar-view").then(module => module.CalendarView))
const LeaderDashboardView = dynamic(() => import("@/components/views/leader-dashboard-view").then(module => module.LeaderDashboardView))
const ClubManagerView = dynamic(() => import("@/components/views/club-manager-view").then(module => module.ClubManagerView))
const ClubManagementPortalView = dynamic(() => import("@/components/views/club-management-portal-view").then(module => module.ClubManagementPortalView))
const ScreeningDashboardView = dynamic(() => import("@/components/views/screening-dashboard-view").then(module => module.ScreeningDashboardView))
const InterviewSchedulerView = dynamic(() => import("@/components/views/interview-scheduler-view").then(module => module.InterviewSchedulerView))
const InterviewWorkspaceView = dynamic(() => import("@/components/views/interview-workspace-view").then(module => module.InterviewWorkspaceView))
const BroadcastMessagesView = dynamic(() => import("@/components/views/club-manager/broadcast-messages-view").then(module => module.BroadcastMessagesView))
const StudentOnboardingWizard = dynamic(() => import("@/components/views/student-onboarding-wizard").then(module => module.StudentOnboardingWizard))

const adminViewIds: ViewId[] = [
  "leader-dashboard",
  "club-manager",
  "club-management-portal",
  "screening-dashboard",
  "interview-scheduler",
  "interview-workspace",
  "broadcast-messages",
]

/** Map URL error codes from OAuth / auth callback redirects to user-facing messages. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "uva_only": "Please sign in using your UVA Microsoft account (@virginia.edu).",
  "auth-code-expired": "Your sign-in link has expired. Please try again.",
}

export type AppShellProps = { launchClubs?: import("@/lib/launch-clubs").LaunchClub[]; initialView?: ViewId; embedded?: boolean; initialSession?: any; initialData?: any; hasProfile?: boolean; initialAuthRole?: "student" | "leader" }

export function AppShell({ launchClubs = [], initialView = "landing", embedded = false, initialSession = null, initialData: realInitialData = null, hasProfile = false, initialAuthRole }: AppShellProps) {
  const demo = useDemoMode()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [personalSection, setPersonalSection] = useState<PersonalSection>("explore")
  const showLanding = !embedded && initialView === "landing" && !searchParams.has("workspace") && !searchParams.has("view") && !searchParams.has("demoClub") && !searchParams.has("next")
  const wantsStudent = searchParams.get("workspace") === "student"
  const { selectClub, user, isImpersonating } = useAuth()
  const initialData = demo.isDemoEnabled ? demoDashboard() : realInitialData
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
    initialAuthRole ? "auth" : showLanding ? "landing" : demo.isDemoEnabled ? (searchParams.has("demoClub") ? "explore" : !wantsStudent && demo.state?.perspective.role === "leader" ? "leader-dashboard" : "student-dashboard") : initialSession
      ? hasProfile
        ? "student-dashboard"
        : "student-onboarding"
      : initialView
  )
  const [appMode, setAppMode] = useState<AppMode>(initialAuthRole ? initialAuthRole === "leader" ? "admin" : "student" : demo.isDemoEnabled ? (!wantsStudent && demo.state?.perspective.role === "leader" ? "admin" : "student") : adminViewIds.includes(initialView) ? "admin" : "student")
  function navigate(next: ViewId, section?: PersonalSection) {
    if (isImpersonating && next === "auth") return
    if (demo.isDemoEnabled && ["auth", "student-onboarding"].includes(next)) { demo.viewAs("student"); return }
    if (resolveStudentView(next)) {
      const nextSection = sectionForStudentView(next, section ?? null)
      setPersonalSection(nextSection)
      const params = new URLSearchParams({ workspace: "student", view: next })
      if (!["explore", "corkboard"].includes(nextSection)) params.set("section", nextSection)
      router.push(`${embedded ? "/preview" : "/"}?${params}`)
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

  if (view === "auth" && isImpersonating) return <main className="p-8">Your administrator login is preserved. Exit impersonation above before changing authentication. <button className="underline" onClick={() => setView("student-dashboard")}>Return to the user’s workspace</button></main>

  if (view === "auth") {
    return <AuthView onCreateAccount={() => setView("student-onboarding")} onEnter={handleEnter} onBack={() => setView("landing")} initialRole={appMode === "admin" ? "leader" : "student"} initialError={authError} />
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
    <ApplicationStateProvider initialData={initialData ?? (initialSession ? { applications: [], attendances: [] } : null)} persistLocalState={!demo.isDemoEnabled && !initialSession && initialData == null}>
      {view === "interview-workspace" ? <InterviewWorkspaceView onExit={() => navigate("leader-dashboard")} /> : <DashboardLayout view={view} appMode={appMode} onNavigate={navigate} onModeChange={switchMode} personalSection={personalSection} onPersonalSection={setPersonalSection}>
            {view === "student-dashboard" && <><OrganizationOwnershipRequests enabled={!!initialSession && !demo.isDemoEnabled} /><StudentDashboardView onNavigate={navigate} initialData={initialData} authenticated={!!initialSession} /></>}
            {view === "student-profile" && <UnifiedStudentProfileView />}
            {view === "inbox" && <InboxView onNavigate={navigate} />}
            {view === "my-clubs" && <PersonalClubs section={personalSection} />}
            {view === "explore" && <ExploreView onNavigate={navigate} section={personalSection === "categories" ? "categories" : "explore"} />}
            {view === "corkboard" && <CorkboardView onNavigate={navigate} />}
            {view === "tracker" && <ApplicationTrackerView onNavigate={navigate} scope="all" />}
            {view === "status" && <ApplicationTrackerView onNavigate={navigate} scope="status" />}
            {view === "calendar" && <CalendarView onNavigate={navigate} />}
            {view === "leader-dashboard" && <LeaderDashboardView />}
            {view === "screening-dashboard" && <ScreeningDashboardView />}
            {view === "interview-scheduler" && (demo.isDemoEnabled ? <DemoInterviewSchedule onNavigate={navigate} /> : <InterviewSchedulerView onNavigate={navigate} />)}
            {view === "broadcast-messages" && <BroadcastMessagesView />}
            {view === "club-manager" && (demo.isDemoEnabled ? <DemoClubSettings /> : <ClubWorkspaceSettings />)}
            {view === "club-management-portal" && <ClubManagementPortalView />}
      </DashboardLayout>}
    </ApplicationStateProvider>
  )
}
