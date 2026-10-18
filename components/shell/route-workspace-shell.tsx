"use client"

import type { ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ApplicationStateProvider } from "@/lib/application-state"
import { AuthSessionBoundary } from "@/components/auth-session-boundary"
import { WorkspaceBreadcrumb } from "@/components/shell/workspace-breadcrumb"
import { ProductShell } from "@/components/shell/product-shell"
import { useAuth } from "@/contexts/auth-context"
import { recruitmentTools } from "@/lib/club-workspace"
import { hasWorkspace } from "@/lib/permissions"
import { managerNavigation, personalDestination, personalItems, personalModes } from "@/lib/product-navigation"
import { personalSettingsSections } from "@/lib/settings-navigation"
import type { ViewId } from "@/lib/views"

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
  const title = member ? "Workspace access" : settings ? settingSection?.label ?? "Settings" : schedule ? "My Interview Schedule" : meetings ? "Meetings" : organizations ? "Organizations" : pathname === "/saved-clubs" ? "Saved clubs" : pathname === "/corkboard" ? "Corkboard" : pathname.endsWith("/workspace") ? "Club workspace" : "Club profile"
  const active = member ? "settings" : settings || organizations ? "settings" : schedule ? "calendar" : meetings ? "meetings" : pathname === "/corkboard" || pathname === "/saved-clubs" ? "corkboard" : "explore"
  function navigate(view: ViewId) {
    router.push(view === "landing" ? "/" : `/?workspace=student&view=${view}`)
  }
  const personalHref = (id: string) => {
    const destination = personalDestination(id)
    const query = new URLSearchParams({ workspace: "student", view: destination.view })
    if (destination.section) query.set("section", destination.section)
    return `/?${query}`
  }
  const clubRoot = member ? `/club/${encodeURIComponent(member.clubId)}/workspace` : ""
  const contextHref = member ? `${clubRoot}?section=settings&setting=members` : organizations ? "/settings/organizations" : settings ? "/settings" : meetings ? "/meetings" : schedule ? "/?workspace=student&view=calendar" : "/?workspace=student&view=explore"
  return <ProductShell manager={!!member} clubId={member?.clubId} clubName={member?.club.name} mode={member ? "club" : mode}
    modes={member ? [...(recruitmentTools(member).length ? [{ id: "recruiting", label: "Recruiting", href: `${clubRoot}?section=recruitment&tool=overview` }] : []), { id: "club", label: "Club", href: `${clubRoot}?section=overview` }] : personalModes.map(item => ({ ...item, href: personalHref(item.id) }))}
    items={member ? managerNavigation(member, member.clubId, "club") : personalItems(mode).map(item => ({ ...item, href: personalHref(item.id) }))}
    active={active} title={title} onNavigate={navigate} onSelect={id => router.push(personalHref(id))}>
    <WorkspaceBreadcrumb items={[
      { label: member?.club.name || "Personal workspace", href: member ? `${clubRoot}?section=overview` : "/?workspace=student" },
      { label: member || settings ? "Settings" : organizations ? "Organizations" : schedule ? "Calendar" : title, href: contextHref },
      ...(settings && settingSection ? [{ label: settingSection.label }] : []),
      ...(schedule ? [{ label: "My Interview Schedule" }] : []),
      ...(accessClubId || pathname.startsWith("/meetings/") || organizations ? [{ label: accessClubId ? "Workspace access" : pathname.startsWith("/invitations") ? "Invitation" : pathname.startsWith("/club-claims") ? "Claim organization" : "Meeting details" }] : []),
    ]} />
    {children}
  </ProductShell>
}
