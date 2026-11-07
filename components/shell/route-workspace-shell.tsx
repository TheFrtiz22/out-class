"use client"

import type { ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ApplicationStateProvider } from "@/lib/application-state"
import { AuthSessionBoundary } from "@/components/auth-session-boundary"
import { ProductShell } from "@/components/shell/product-shell"
import { useAuth } from "@/contexts/auth-context"
import { hasWorkspace } from "@/lib/permissions"
import { personalDestination } from "@/lib/product-navigation"
import { personalSettingsSections } from "@/lib/settings-navigation"
import type { ViewId } from "@/lib/views"
import { leaderRailSections, personalRailSections, studentPath } from "@/lib/navigation"

const initialData = { applications: [], attendances: [] }

export function RouteWorkspaceShell({ children }: { children: ReactNode }) {
  return <AuthSessionBoundary><ApplicationStateProvider initialData={initialData} persistLocalState={false}><RouteWorkspaceContent>{children}</RouteWorkspaceContent></ApplicationStateProvider></AuthSessionBoundary>
}

function RouteWorkspaceContent({ children }: { children: ReactNode }) {
  const pathname = usePathname(), router = useRouter()
  const { user } = useAuth()
  const accessClubId = pathname.match(/^\/club-access\/([^/]+)/)?.[1]
  const member = user?.memberships.find(m => m.clubId === accessClubId && hasWorkspace(m))
  const schedule = pathname === "/settings/interviews"
  const settingSection = personalSettingsSections.find(section => section.href === pathname)
  const settings = pathname.startsWith("/settings") && !schedule
  const meetings = pathname.startsWith("/meetings")
  const organizations = pathname.startsWith("/club-claims") || pathname.startsWith("/invitations")
  const mode = meetings ? "clubs" : "explore"
  const title = member ? "Workspace access" : settings ? settingSection?.label ?? "Settings" : schedule ? "My Interview Schedule" : meetings ? "Meetings" : organizations ? "Clubs" : pathname === "/saved-clubs" ? "Saved clubs" : pathname === "/corkboard" ? "Corkboard" : pathname.endsWith("/workspace") ? "Club workspace" : "Club profile"
  const active = member ? "settings" : settings || organizations ? "settings" : schedule ? "calendar" : meetings ? "meetings" : pathname === "/corkboard" || pathname === "/saved-clubs" ? "corkboard" : "explore"
  function navigate(view: ViewId) {
    router.push(view === "landing" ? "/" : studentPath(view))
  }
  const personalHref = (id: string) => {
    const destination = personalDestination(id)
    return studentPath(destination.view, destination.section)
  }
  return <ProductShell manager={!!member} clubId={member?.clubId} clubName={member?.club.name} mode={member ? "club" : mode}
    sections={member ? leaderRailSections(member, member.clubId) : personalRailSections()}
    active={active} title={title} onNavigate={navigate} onSelect={id => router.push(personalHref(id))}>
    {children}
  </ProductShell>
}
