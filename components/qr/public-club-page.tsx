"use client"
import { ApplicationStateProvider } from "@/lib/application-state"
import { ClubProfileView } from "@/components/views/club-profile-view"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { ApplicationTrackerView } from "@/components/views/application-tracker-view"
import { CalendarView } from "@/components/views/calendar-view"
import { Button } from "@/components/ui/button"
import { PublicNavigation } from "@/components/landing/public-navigation"
import "@/components/views/landing.css"
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
    if (next === "auth" || next === "student-onboarding") {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
      window.location.href = `${next === "auth" ? "/login" : "/signup"}?next=${encodeURIComponent(returnTo)}`
      return
    }
    if (["explore", "corkboard", "student-profile"].includes(next)) { window.location.href = `/?workspace=student&view=${next}`; return }
    setView(next)
  }
  return (
    <ApplicationStateProvider
      key={`${identity}:${dashboard ? "ready" : "initial"}`}
      initialData={dashboard ?? (authenticated ? emptyPrivateDashboard : null)}
      persistLocalState={!authenticated && dashboard == null}
    >
      <div className="oc-landing oc-information">
      <PublicNavigation />
      <main className="min-h-svh bg-background px-5 py-8 font-sans sm:px-8 sm:py-12">
        {view !== "profile" && (
          <Button variant="ghost" className="mb-6" onClick={() => setView("profile")}>
            Back to club profile
          </Button>
        )}
        {view === "tracker" || view === "status" ? (
          <ApplicationTrackerView onNavigate={navigate} scope={view === "status" ? "status" : "all"} />
        ) : view === "calendar" ? (
          <CalendarView onNavigate={navigate} />
        ) : (
          <ClubProfileView
            club={club}
            backLabel="Back to OutClass"
            onBack={() => {
              window.location.href = "/"
            }}
            onNavigate={navigate}
          />
        )}
      </main>
      </div>
    </ApplicationStateProvider>
  )
}
