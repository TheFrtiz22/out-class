"use client"

import { useMemo, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ApplicationStateProvider } from "@/lib/application-state"
import { AuthSessionBoundary } from "@/components/auth-session-boundary"
import { ProductShell } from "@/components/shell/product-shell"
import { WorkspaceShellContext, useShellBindingsState, type ShellBindings } from "@/components/shell/workspace-shell-context"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { hasWorkspace, type ClubAccess } from "@/lib/permissions"
import { personalDestination } from "@/lib/product-navigation"
import { personalSettingsSectionFor } from "@/lib/settings-navigation"
import { adminNavigation } from "@/lib/admin-navigation"
import { adminRailSections, leaderRailSections, memberRailSections, personalRailSections, studentPath, type RailSection } from "@/lib/navigation"
import type { ViewId } from "@/lib/views"

/** One empty, server-mode store for the whole group; the student app seeds its server data into it. */
const initialData = { applications: [], attendances: [], events: [], memberships: [] }

/**
 * The persistent shell for `app/(workspace)`: header, workspace pill, utilities, rail and bottom bar
 * mount once per session. Session restore keeps its full-screen cover (AuthSessionBoundary); every
 * later navigation keeps the shell on screen and shows content-area placeholders.
 */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  return <AuthSessionBoundary><ApplicationStateProvider initialData={initialData} persistLocalState={false}><RoutedShell>{children}</RoutedShell></ApplicationStateProvider></AuthSessionBoundary>
}

type Route = {
  kind: "personal" | "club" | "admin"
  clubId: string
  membership?: ClubAccess & { club: { name: string } }
  manager: boolean
  mode: string
  sections: RailSection[]
  title: string
  active: string
}

/** The workspace for a URL. Club pages that the account cannot open keep the personal rail; the page itself refuses. */
export function workspaceRoute(pathname: string, params: URLSearchParams, memberships: (ClubAccess & { clubId: string; club: { name: string; suspendedAt?: string | Date | null } })[], demo: boolean): Route {
  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    const active = pathname.split("/")[2] || "overview"
    return { kind: "admin", clubId: "", manager: true, mode: "platform", sections: adminRailSections(), active, title: adminNavigation.find(item => item.id === active)?.label || "Admin" }
  }
  const workspace = pathname.match(/^\/club\/([^/]+)\/workspace$/)
  if (workspace) {
    const clubId = decodeURIComponent(workspace[1]!)
    const membership = memberships.find(member => member.clubId === clubId)
    const suspended = !demo && !!membership?.club.suspendedAt
    if (membership && !suspended) {
      const manager = !!membership && hasWorkspace(membership)
      const section = params.get("section") ?? "overview"
      const recruiting = section === "recruitment" || section === "announcements" && params.get("mode") === "recruiting"
      return { kind: "club", clubId, membership, manager, mode: manager ? recruiting ? "recruiting" : "club" : "clubs",
        sections: manager ? leaderRailSections(membership!, clubId, params.toString()) : memberRailSections(clubId, membership?.club.name),
        active: section, title: "Club workspace" }
    }
  }
  const accessClubId = pathname.match(/^\/club-access\/([^/]+)/)?.[1]
  const access = accessClubId ? memberships.find(member => member.clubId === decodeURIComponent(accessClubId) && hasWorkspace(member)) : undefined
  if (access) return { kind: "club", clubId: access.clubId, membership: access, manager: true, mode: "club", sections: leaderRailSections(access, access.clubId), active: "settings", title: "Workspace access" }
  const schedule = pathname === "/settings/interviews"
  const settings = pathname.startsWith("/settings") && !schedule
  const meetings = pathname.startsWith("/meetings")
  const organizations = pathname.startsWith("/club-claims") || pathname.startsWith("/invitations")
  const title = settings ? personalSettingsSectionFor(pathname)?.label ?? "Settings" : schedule ? "My Interview Schedule" : meetings ? "Meetings" : organizations ? "Clubs" : pathname === "/saved-clubs" ? "Saved clubs" : pathname === "/corkboard" ? "Events" : /^\/club\/[^/]+$/.test(pathname) ? "Club profile" : "OutClass"
  const active = settings || organizations ? "settings" : schedule ? "calendar" : meetings ? "meetings" : pathname === "/corkboard" || pathname === "/saved-clubs" ? "corkboard" : "explore"
  return { kind: "personal", clubId: "", manager: false, mode: meetings ? "clubs" : "explore", sections: personalRailSections(), active, title }
}

/** Where a notification, search result or tour step's view opens when the page registered no navigation. */
export function viewHref(kind: Route["kind"], view: ViewId) {
  if (kind === "admin") return view === "student-profile" ? "/profile" : view === "inbox" ? "/inbox" : "/home"
  return view === "landing" ? "/" : studentPath(view)
}

function RoutedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(), params = useSearchParams(), router = useRouter()
  const { user } = useAuth(), demo = useDemoMode()
  const [bindings, registry] = useShellBindingsState()
  const search = params.toString()
  const memberships = user?.memberships
  const route = useMemo(() => workspaceRoute(pathname, new URLSearchParams(search), (memberships ?? []) as Parameters<typeof workspaceRoute>[2], demo.isDemoEnabled), [pathname, search, memberships, demo.isDemoEnabled])
  const bound: ShellBindings = bindings ?? {}
  function navigate(view: ViewId) {
    if (bound.onNavigate) { bound.onNavigate(view); return }
    router.push(viewHref(route.kind, view))
  }
  function select(id: string) {
    if (bound.onSelect) { bound.onSelect(id); return }
    if (route.kind === "admin") { router.push(adminNavigation.find(item => item.id === id)?.href || "/platform"); return }
    if (route.kind === "personal") { const destination = personalDestination(id); router.push(studentPath(destination.view, destination.section)) }
  }
  return <WorkspaceShellContext.Provider value={registry}>
    <ProductShell workspaceKind={route.kind === "admin" ? "admin" : undefined} manager={route.manager} clubId={route.clubId} clubName={route.membership?.club.name}
      mode={route.mode} sections={route.sections} active={bound.active ?? route.active} title={bound.title ?? route.title}
      chrome={!bound.bare} onSelect={select} onNavigate={navigate} onModeSelect={bound.onModeSelect}>
      {children}
    </ProductShell>
  </WorkspaceShellContext.Provider>
}
