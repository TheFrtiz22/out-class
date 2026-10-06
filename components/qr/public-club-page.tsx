"use client"
import { ApplicationStateProvider } from "@/lib/application-state"
import { ClubProfileView } from "@/components/views/club-profile-view"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { ApplicationTrackerView } from "@/components/views/application-tracker-view"
import { CalendarView } from "@/components/views/calendar-view"
import { AuthView } from "@/components/views/auth-view"
import { StudentOnboardingWizard } from "@/components/views/student-onboarding-wizard"
import { Button } from "@/components/ui/button"
import type { DirectoryClub } from "@/lib/club-directory"
import type { ViewId } from "@/lib/views"
import { getStudentDashboardData } from "@/lib/workspace-api"
const emptyPrivateDashboard = { applications: [], attendances: [], meetings: [] }
export function PublicClubPage({
  club,
  initialData,
  authenticated = false,
}: {
  club: DirectoryClub
  initialData?: Awaited<ReturnType<typeof getStudentDashboardData>> | null
  authenticated?: boolean
}) {
  const [view, setView] = useState<ViewId | "profile">("profile")
  const { user } = useAuth()
  const identity = authenticated ? user?.id ?? "" : "public"
  const initialOwner = useRef(identity)
  const [privateData, setPrivateData] = useState({ owner: identity, data: initialData ?? null })
  useEffect(() => {
    if (!authenticated || !identity || initialData && initialOwner.current === identity) return
    let current = true
    getStudentDashboardData().then(data => { if (current) setPrivateData({ owner: identity, data }) }).catch(() => { if (current) setPrivateData({ owner: identity, data: null }) })
    return () => { current = false }
  }, [authenticated, identity, initialData])
  const dashboard = privateData.owner === identity ? privateData.data : null
  function navigate(next: ViewId) {
    if (["explore", "corkboard"].includes(next)) { window.location.href = `/?workspace=student&view=${next}`; return }
    setView(next)
  }
  if (view === "auth")
    return (
      <AuthView
        onBack={() => setView("profile")}
        onCreateAccount={() => setView("student-onboarding")}
        onEnter={() => setView("profile")}
      />
    )
  if (view === "student-onboarding")
    return (
      <StudentOnboardingWizard
        onBack={() => setView("profile")}
        onSignIn={() => setView("auth")}
        onComplete={() => window.location.reload()}
      />
    )
  return (
    <ApplicationStateProvider
      key={`${identity}:${dashboard ? "ready" : "initial"}`}
      initialData={dashboard ?? (authenticated ? emptyPrivateDashboard : null)}
      persistLocalState={!authenticated && dashboard == null}
    >
      <main className="min-h-svh bg-background px-5 py-8 font-sans sm:px-8 sm:py-12">
        {view !== "profile" && (
          <Button variant="ghost" className="mb-6" onClick={() => setView("profile")}>
            Back to club profile
          </Button>
        )}
        {view === "tracker" ? (
          <ApplicationTrackerView onNavigate={navigate} />
        ) : view === "calendar" ? (
          <CalendarView onNavigate={navigate} />
        ) : (
          <ClubProfileView
            club={club}
            onBack={() => {
              window.location.href = "/"
            }}
            onNavigate={navigate}
          />
        )}
      </main>
    </ApplicationStateProvider>
  )
}
