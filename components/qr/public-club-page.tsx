"use client"
import { ApplicationStateProvider } from "@/lib/application-state"
import { ClubProfileView } from "@/components/views/club-profile-view"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { ApplicationTrackerView } from "@/components/views/application-tracker-view"
import { CalendarView } from "@/components/views/calendar-view"
import { Button } from "@/components/ui/button"
import type { DirectoryClub } from "@/lib/club-directory"
import type { ViewId } from "@/lib/views"
import { getStudentDashboardData } from "@/lib/workspace-api"
import { studentPath } from "@/lib/navigation"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { clubBreadcrumbs } from "@/lib/seo"
const emptyPrivateDashboard = { applications: [], attendances: [], meetings: [] }
export function PublicClubPage({
  club,
  initialData,
  authenticated = false,
  embedded = false,
  serverNow,
}: {
  club: DirectoryClub
  serverNow?: number
  initialData?: Awaited<ReturnType<typeof getStudentDashboardData>> | null
  authenticated?: boolean
  embedded?: boolean
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
    if (embedded || ["explore", "corkboard", "student-profile"].includes(next)) { window.location.href = studentPath(next); return }
    setView(next)
  }
  return (
    <ApplicationStateProvider
      key={`${identity}:${dashboard ? "ready" : "initial"}`}
      initialData={dashboard ?? (authenticated ? emptyPrivateDashboard : null)}
      persistLocalState={!authenticated && dashboard == null}
    >
      {/* Signed out, the route layout supplies the public header, page margins and footer. */}
      <div className="min-w-0">
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
            backLabel={embedded ? "Explore clubs" : "Back to OutClass"}
            onBack={() => {
              window.location.href = embedded ? "/explore" : "/"
            }}
            breadcrumbs={<Breadcrumbs className="oc-club-breadcrumbs" items={clubBreadcrumbs(club.name, { signedIn: embedded })} />}
            onNavigate={navigate}
            serverNow={serverNow}
          />
        )}
      </div>
    </ApplicationStateProvider>
  )
}
