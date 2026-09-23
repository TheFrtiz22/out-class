"use client"

import { DemoClubSettings, DemoInterviewSchedule } from "@/components/demo-workspace"
import { useDemoMode } from "@/contexts/demo-context"
import { demoDashboard } from "@/lib/demo/store"
import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { type AppMode, type ViewId } from "@/lib/views"
import { ApplicationStateProvider } from "@/lib/application-state"

import { LandingPageView } from "@/components/views/landing-page-view"
import { AuthView } from "@/components/views/auth-view"
import { StudentDashboardView } from "@/components/views/student-dashboard-view"
import { UnifiedStudentProfileView } from "@/components/views/unified-student-profile-view"
import { InboxView } from "@/components/views/inbox-view"
import { DiscoverView } from "@/components/views/discover-view"
import { ApplicationTrackerView } from "@/components/views/application-tracker-view"
import { CalendarView } from "@/components/views/calendar-view"
import { LeaderDashboardView } from "@/components/views/leader-dashboard-view"
import { ClubManagerView } from "@/components/views/club-manager-view"
import { ClubManagementPortalView } from "@/components/views/club-management-portal-view"
import { ScreeningDashboardView } from "@/components/views/screening-dashboard-view"
import { InterviewSchedulerView } from "@/components/views/interview-scheduler-view"
import { InterviewWorkspaceView } from "@/components/views/interview-workspace-view"
import { BroadcastMessagesView } from "@/components/views/club-manager/broadcast-messages-view"
import { StudentOnboardingWizard } from "@/components/views/student-onboarding-wizard"

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

export function AppShell({ initialView = "landing", embedded = false, initialSession = null, initialData: realInitialData = null, hasProfile = false }: { initialView?: ViewId; embedded?: boolean, initialSession?: any, initialData?: any, hasProfile?: boolean }) {
  const demo = useDemoMode()
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
    demo.isDemoEnabled ? (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demoClub") ? "discover" : demo.state?.perspective.role === "leader" ? "leader-dashboard" : "student-dashboard") : initialSession
      ? hasProfile
        ? "student-dashboard"
        : "student-onboarding"
      : initialView
  )
  const [appMode, setAppMode] = useState<AppMode>(demo.isDemoEnabled ? (demo.state?.perspective.role === "leader" ? "admin" : "student") : adminViewIds.includes(initialView) ? "admin" : "student")
  function navigate(next: ViewId) { if (demo.isDemoEnabled && ["landing", "auth", "student-onboarding"].includes(next)) { demo.viewAs("student"); return } setView(embedded && next === "landing" ? initialView : next) }

  // If an auth error was found in the URL, force the auth view so the user sees the message
  useEffect(() => {
    if (authError && !initialSession) {
      setView("auth")
    }
  }, [authError, initialSession])

  function handleEnter(next: ViewId) {
    if (!adminViewIds.includes(next)) {
      try { sessionStorage.setItem("outclass-demo-student", "true") } catch { /* Demo remains usable without session storage. */ }
    }
    setAppMode(adminViewIds.includes(next) ? "admin" : "student")
    setView(next)
  }

  function switchMode(mode: AppMode) {
    if (demo.isDemoEnabled) { demo.viewAs(mode === "admin" ? "leader" : "student"); return }
    setAppMode(mode)
    setView(mode === "admin" ? "leader-dashboard" : "student-dashboard")
  }

  if (view === "landing") {
    return (
      <LandingPageView
        onNavigateToApp={(role) => {
          setAppMode(role === "leader" ? "admin" : "student")
          setView("auth")
        }}
      />
    )
  }

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
          window.location.href = "/"
        }}
      />
    )
  }


  return (
    <ApplicationStateProvider initialData={initialData} persistLocalState={!demo.isDemoEnabled && !initialSession && initialData == null}>
      {view === "interview-workspace" ? <InterviewWorkspaceView onExit={() => navigate("leader-dashboard")} /> : <DashboardLayout view={view} appMode={appMode} onNavigate={navigate} onModeChange={switchMode}>
            {view === "student-dashboard" && <StudentDashboardView onNavigate={navigate} initialData={initialData} authenticated={!!initialSession} />}
            {view === "student-profile" && <UnifiedStudentProfileView />}
            {view === "inbox" && <InboxView onNavigate={navigate} />}
            {view === "discover" && <DiscoverView onNavigate={navigate} />}
            {view === "tracker" && <ApplicationTrackerView onNavigate={navigate} />}
            {view === "calendar" && <CalendarView onNavigate={navigate} />}
            {view === "leader-dashboard" && <LeaderDashboardView />}
            {view === "screening-dashboard" && <ScreeningDashboardView />}
            {view === "interview-scheduler" && (demo.isDemoEnabled ? <DemoInterviewSchedule onNavigate={navigate} /> : <InterviewSchedulerView onNavigate={navigate} />)}
            {view === "broadcast-messages" && <BroadcastMessagesView />}
            {view === "club-manager" && (demo.isDemoEnabled ? <DemoClubSettings /> : <ClubManagerView />)}
            {view === "club-management-portal" && <ClubManagementPortalView />}
      </DashboardLayout>}
    </ApplicationStateProvider>
  )
}

