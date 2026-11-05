import { managerNavigation, mobileDestinations, type ProductNavItem } from "@/lib/product-navigation"
import type { ClubAccess } from "@/lib/permissions"
import { adminNavigation } from "@/lib/admin-navigation"
import { STUDENT_HOME } from "@/lib/student-routes"

/**
 * Navigation for OutClass. Student URL routes (and the old-URL redirects that
 * middleware uses) live in lib/student-routes, which stays free of UI imports;
 * they are re-exported here so callers have one module to import.
 */
export * from "@/lib/student-routes"

/* ───────────────────────── Shell navigation registry ─────────────────────────
 * The rail, the phone bottom bar and the workspace pill read their items and
 * their active state from here. Active state is derived from the URL, so the
 * highlighted item always matches the page being shown.
 */
/** `label` is a visible heading; `name` labels an unheaded group for assistive technology. */
export type RailSection = { id: string; label?: string; name?: string; tour?: string; items: ProductNavItem[] }
export type WorkspaceKind = "personal" | "leader" | "admin"
export type WorkspaceOption = { id: WorkspaceKind; clubId?: string; label: string; href: string }

const personal = (id: string, label: string, path: string): ProductNavItem => ({ id, label, href: path })

/** Personal workspace sections. Notifications and search live only in the header. */
export function personalRailSections(options: { settings?: boolean } = {}): RailSection[] {
  return [
    { id: "home", name: "Home", items: [personal("student-dashboard", "Home", "/home")] },
    { id: "explore", name: "Explore", items: [personal("explore", "Explore", "/explore"), personal("corkboard", "Corkboard", "/corkboard")] },
    { id: "apply", name: "Applications", items: [personal("applications", "Applications", "/applications"), personal("status", "Status", "/applications/status")] },
    { id: "clubs", name: "Clubs", items: [personal("clubs", "My Clubs", "/clubs"), personal("meetings", "Meetings", "/clubs/meetings"), personal("tasks", "Tasks", "/clubs/tasks"), personal("calendar", "Calendar", "/calendar")] },
    { id: "account", name: "Account", items: [personal("student-profile", "Profile", "/profile"), ...(options.settings === false ? [] : [personal("settings", "Settings", "/settings")])] },
  ]
}

/** A member (non-leader) club page: personal sections plus that club's own pages. */
export function memberRailSections(clubId: string, clubName: string | undefined, options: { settings?: boolean } = {}): RailSection[] {
  const root = `/club/${encodeURIComponent(clubId)}/workspace`
  const club: RailSection = { id: "member-club", label: clubName || "Club", items: [
    { id: "club-home", label: "Club home", href: `${root}?section=overview` },
    { id: "club-meetings", label: "Meetings", href: `${root}?section=meetings` },
    { id: "club-tasks", label: "Tasks", href: `${root}?section=tasks` },
  ] }
  const sections = personalRailSections(options)
  return [...sections.slice(0, -1), club, sections[sections.length - 1]]
}

/**
 * Club workspace sections. Recruiting and Club used to be separate pill modes;
 * both now live in the rail. Announcements and Settings appear once, under Club.
 */
export function leaderRailSections(member: ClubAccess, clubId: string, search = ""): RailSection[] {
  const shared = new Set(["announcements", "settings"])
  const recruiting = managerNavigation(member, clubId, "recruiting", search).filter(item => !shared.has(item.id))
  const club = managerNavigation(member, clubId, "club", search).map(item => item.id === "overview" ? { ...item, id: "club-home", label: "Club home" } : item)
  // Only Overview means the member has no recruiting tools; the overview alone is not a section.
  const hasRecruiting = recruiting.some(item => item.id !== "overview")
  return [
    ...(hasRecruiting ? [{ id: "recruiting", label: "Recruiting", tour: "mode-recruiting", items: recruiting.map(item => ({ ...item, mode: "recruiting" as const })) }] : []),
    { id: "club", label: "Club", tour: "mode-club", items: club.map(item => ({ ...item, mode: "club" as const })) },
  ]
}

/** Admin sections, grouped as on the platform pages. Home has no heading. */
export function adminRailSections(): RailSection[] {
  return ["Home", "Platform", "Operations", "System"].map(group => ({ id: `admin-${group.toLowerCase()}`, label: group === "Home" ? undefined : group, name: group, items: adminNavigation.filter(item => item.group === group) }))
}

export function railItems(sections: RailSection[]): ProductNavItem[] {
  return sections.flatMap(section => section.items)
}

/**
 * The pill's segments: the same three in every mode. The club segment carries the
 * current club's name; leaders of several clubs pick another club with the club switcher.
 */
export function workspaceOptions(input: {
  personal: boolean; admin: boolean
  club?: { clubId: string; name: string } | null
  settingsSection?: string | null; inSettings?: boolean
}): WorkspaceOption[] {
  const { club } = input
  return [
    ...(input.personal ? [{ id: "personal" as const, label: "Personal", href: input.inSettings ? "/settings" : STUDENT_HOME }] : []),
    ...(club ? [{ id: "leader" as const, clubId: club.clubId, label: club.name, href: input.settingsSection ? `/club/${encodeURIComponent(club.clubId)}/workspace?section=settings&setting=${input.settingsSection}` : `/club/${encodeURIComponent(club.clubId)}/workspace` }] : []),
    ...(input.admin ? [{ id: "admin" as const, label: "Admin", href: "/platform" }] : []),
  ]
}

/** Accessible name for a workspace segment; the club segment shows only the club's name. */
export function workspaceOptionName(option: WorkspaceOption) {
  return option.id === "leader" ? `${option.label} club workspace` : `${option.label} workspace`
}

const personalPathItems: Record<string, string> = {
  "/home": "student-dashboard", "/explore": "explore", "/explore/categories": "explore", "/corkboard": "corkboard", "/saved-clubs": "corkboard",
  "/applications": "applications", "/applications/status": "status", "/clubs": "clubs", "/clubs/meetings": "meetings", "/meetings": "meetings",
  "/clubs/tasks": "tasks", "/calendar": "calendar", "/settings/interviews": "calendar", "/profile": "student-profile",
}

/**
 * The rail item for the current page, or null when no rail item represents it
 * (Notifications, for example, is reached from the header bell).
 */
export function activeNavItem(pathname: string, params: URLSearchParams = new URLSearchParams(), options: { member?: boolean } = {}): string | null {
  if (personalPathItems[pathname]) return personalPathItems[pathname]
  if (pathname.startsWith("/settings") || pathname.startsWith("/club-claims") || pathname.startsWith("/invitations") || pathname.startsWith("/club-access/")) return "settings"
  if (/^\/club\/[^/]+\/workspace$/.test(pathname)) {
    const section = params.get("section") || "overview", tool = params.get("tool")
    // Same mapping the club workspace uses to pick its content.
    if (section === "recruitment") return tool === "rounds" || tool === "rules" ? "overview" : tool || "applicants"
    if (section === "overview") return "club-home"
    return options.member && (section === "meetings" || section === "tasks") ? `club-${section}` : section
  }
  const platform = pathname.match(/^\/platform(?:\/([^/?]+))?/)
  if (platform) return platform[1] || "overview"
  return null
}

/**
 * Phone bottom bar: four destinations, then More for the rest of the rail.
 * A leader sees the section holding the current page (Recruiting or Club).
 */
export function bottomBarItems(sections: RailSection[], kind: WorkspaceKind | "preview", active?: string | null): ProductNavItem[] {
  if (kind === "personal") {
    const items = railItems(sections)
    return ["student-dashboard", "explore", "applications", "clubs"].map(id => items.find(item => item.id === id)).filter((item): item is ProductNavItem => !!item)
  }
  const current = sections.find(section => section.items.some(item => item.id === active)) ?? sections[0]
  return current ? mobileDestinations(current.items).slice(0, 4) : []
}
