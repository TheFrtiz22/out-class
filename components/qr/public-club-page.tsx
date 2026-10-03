"use client"
import { ApplicationStateProvider } from "@/lib/application-state"
import { ClubProfileView } from "@/components/views/club-profile-view"
import { useState } from "react"
import { ApplicationTrackerView } from "@/components/views/application-tracker-view"
import { CalendarView } from "@/components/views/calendar-view"
import { AuthView } from "@/components/views/auth-view"
import { StudentOnboardingWizard } from "@/components/views/student-onboarding-wizard"
import { Button } from "@/components/ui/button"
import type { DirectoryClub } from "@/lib/club-directory"
import type { ViewId } from "@/lib/views"
import type { getStudentDashboardData } from "@/lib/workspace-api"
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
      initialData={initialData}
      persistLocalState={!authenticated && initialData == null}
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
