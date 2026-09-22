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
import type { getStudentDashboardData } from "@/actions/applications"
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
          <ApplicationTrackerView onNavigate={setView} />
        ) : view === "calendar" ? (
          <CalendarView onNavigate={setView} />
        ) : (
          <ClubProfileView
            club={club}
            onBack={() => {
              window.location.href = "/"
            }}
            onNavigate={setView}
          />
        )}
      </main>
    </ApplicationStateProvider>
  )
}
