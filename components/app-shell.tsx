"use client"

import { useState } from "react"
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

const adminViewIds: ViewId[] = [
  "leader-dashboard",
  "club-manager",
  "club-management-portal",
  "screening-dashboard",
  "interview-scheduler",
  "interview-workspace",
  "broadcast-messages",
]

export function AppShell() {
  const [view, setView] = useState<ViewId>("landing")
  const [appMode, setAppMode] = useState<AppMode>("student")

  function handleEnter(next: ViewId) {
    setAppMode(adminViewIds.includes(next) ? "admin" : "student")
    setView(next)
  }

  function switchMode(mode: AppMode) {
    setAppMode(mode)
    setView(mode === "admin" ? "leader-dashboard" : "student-dashboard")
  }

  if (view === "landing") {
    return (
      <LandingPageView
        onNavigateToApp={(role) => {
          if (role === "leader") {
            setAppMode("admin")
            setView("leader-dashboard")
          } else {
            setAppMode("student")
            setView("student-dashboard")
          }
        }}
      />
    )
  }

  if (view === "auth") {
    return <AuthView onEnter={handleEnter} />
  }


  return (
    <ApplicationStateProvider>
      <DashboardLayout view={view} appMode={appMode} onNavigate={setView} onModeChange={switchMode}>
            {view === "student-dashboard" && <StudentDashboardView onNavigate={setView} />}
            {view === "student-profile" && <UnifiedStudentProfileView />}
            {view === "inbox" && <InboxView />}
            {view === "discover" && <DiscoverView onNavigate={setView} />}
            {view === "tracker" && <ApplicationTrackerView onNavigate={setView} />}
            {view === "calendar" && <CalendarView onNavigate={setView} />}
            {view === "leader-dashboard" && <LeaderDashboardView />}
            {view === "screening-dashboard" && <ScreeningDashboardView />}
            {view === "interview-scheduler" && <InterviewSchedulerView onNavigate={setView} />}
            {view === "interview-workspace" && <InterviewWorkspaceView />}
            {view === "broadcast-messages" && <BroadcastMessagesView />}
            {view === "club-manager" && <ClubManagerView />}
            {view === "club-management-portal" && <ClubManagementPortalView />}
      </DashboardLayout>
    </ApplicationStateProvider>
  )
}
