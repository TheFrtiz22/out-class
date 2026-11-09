import { managerNavigation, mobileDestinations, type ProductNavItem } from "@/lib/product-navigation"
import type { ClubAccess } from "@/lib/permissions"
import { adminNavigation } from "@/lib/admin-navigation"
import { STUDENT_HOME } from "@/lib/student-routes"
import { TERMS } from "@/lib/copy/terms"

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
export type WorkspaceOption = { id: WorkspaceKind; clubId?: string; label: string; shortLabel?: string; href: string }

/** Connector words that never contribute a letter to a club abbreviation. */
const ABBREVIATION_SKIP = new Set(["a", "an", "and", "at", "for", "in", "of", "on", "the", "to", "&", "-"])

/**
 * A club's automatic short label for the workspace pill when no nickname is set: the initials of its
 * significant words, up to four ("McIntire Investment Institute" → "MII", "Society of Women Engineers"
 * → "SWE"). A one-word name of eight characters or fewer stays as written; a longer one is cut to six.
 * Unlike the share card's monogram (lib/club-share-text initials), connector words are skipped.
 */
export function clubAbbreviation(name: string) {
  const words = name.replace(/[()[\]{}"'’.,:;!?]/g, " ").split(/\s+/).filter(Boolean)
  const significant = words.filter(word => !ABBREVIATION_SKIP.has(word.toLowerCase()))
  const source = significant.length ? significant : words
  if (source.length === 1) return source[0].length <= 8 ? source[0] : source[0].slice(0, 6)
  return source.map(word => word.match(/[A-Za-z0-9]/)?.[0] ?? "").join("").slice(0, 4).toUpperCase() || name.trim().slice(0, 6)
}

/** The pill's short label: the club's own short name when set, otherwise the automatic abbreviation. */
export function clubShortLabel(club: { name: string; shortName?: string | null }) {
  return club.shortName?.trim() || clubAbbreviation(club.name)
}

const personal = (id: string, label: string, path: string): ProductNavItem => ({ id, label, href: path })

/** Personal workspace sections. Notifications and search live only in the header. */
export function personalRailSections(options: { settings?: boolean } = {}): RailSection[] {
  return [
    // Seven destinations. Settings is in the account menu, Inbox behind the bell, Status is an
    // Applications tab, Meetings a Calendar filter, and Tasks is reached from My Clubs and Home.
    { id: "home", name: "Home", items: [personal("student-dashboard", "Home", "/home")] },
    { id: "explore", name: "Explore", items: [personal("explore", "Explore", "/explore"), personal("corkboard", TERMS.events, "/corkboard")] },
    { id: "apply", name: "Applications", items: [personal("applications", "Applications", "/applications")] },
    { id: "clubs", name: "Clubs", items: [personal("clubs", TERMS.myClubs, "/clubs"), personal("calendar", "Calendar", "/calendar")] },
    { id: "account", name: "Account", items: [personal("student-profile", "Profile", "/profile")] },
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

/** The /preview sample shell navigates in place: items become buttons handled by the shell's onSelect. */
export function inPlaceSections(sections: RailSection[]): RailSection[] {
  return sections.map(section => ({ ...section, items: section.items.map(({ href: _href, ...item }) => item) }))
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
  club?: { clubId: string; name: string; shortName?: string | null } | null
  settingsSection?: string | null; inSettings?: boolean
}): WorkspaceOption[] {
  const { club } = input
  return [
    ...(input.personal ? [{ id: "personal" as const, label: "Personal", href: input.inSettings ? "/settings" : STUDENT_HOME }] : []),
    ...(club ? [{ id: "leader" as const, clubId: club.clubId, label: club.name, shortLabel: clubShortLabel(club), href: input.settingsSection ? `/club/${encodeURIComponent(club.clubId)}/workspace?section=settings&setting=${input.settingsSection}` : `/club/${encodeURIComponent(club.clubId)}/workspace` }] : []),
    ...(input.admin ? [{ id: "admin" as const, label: "Admin", href: "/platform" }] : []),
  ]
}

/** Accessible name for a workspace segment; the club segment shows only the club's name. */
export function workspaceOptionName(option: WorkspaceOption) {
  return option.id === "leader" ? `${option.label} club workspace` : `${option.label} workspace`
}

const personalPathItems: Record<string, string> = {
  "/home": "student-dashboard", "/explore": "explore", "/explore/categories": "explore", "/corkboard": "corkboard", "/saved-clubs": "corkboard",
  "/applications": "applications", "/applications/status": "applications", "/clubs": "clubs", "/clubs/meetings": "calendar", "/meetings": "calendar",
  "/clubs/tasks": "clubs", "/calendar": "calendar", "/settings/interviews": "calendar", "/profile": "student-profile",
}

/**
 * The rail item for the current page, or null when no rail item represents it
 * (Notifications, for example, is reached from the header bell).
 */
export function activeNavItem(pathname: string, params: URLSearchParams = new URLSearchParams(), options: { member?: boolean } = {}): string | null {
  if (personalPathItems[pathname]) return personalPathItems[pathname]
  // Detail pages highlight their parent section; the header bell owns Notifications.
  if (pathname === "/inbox") return null
  if (pathname.startsWith("/meetings/")) return "calendar"
  if (pathname.startsWith("/applications/")) return "applications"
  if (/^\/club\/[^/]+$/.test(pathname)) return "explore"
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
  if (kind === "leader") return leaderBottomBar(sections)
  const current = sections.find(section => section.items.some(item => item.id === active)) ?? sections[0]
  return current ? mobileDestinations(current.items).slice(0, 4) : []
}

/**
 * Club workspace phone bar: one fixed set whatever the page — Home · Recruiting · Meetings · Members
 * (then More). Recruiting opens the recruiting dashboard; its sub-pages show as in-page tabs.
 * A member without a destination gets the next club page instead (Tasks, Announcements, Settings).
 */
function leaderBottomBar(sections: RailSection[]): ProductNavItem[] {
  const items = railItems(sections), find = (id: string) => items.find(item => item.id === id && item.mode !== "recruiting")
  const recruiting = sections.find(section => section.id === "recruiting")
  const recruitingItem: ProductNavItem | undefined = recruiting && recruiting.items.length ? { id: "recruiting", label: "Recruiting", href: (recruiting.items.find(item => item.id === "overview") ?? recruiting.items[0]).href, mode: "recruiting", matches: recruiting.items.map(item => item.id) } : undefined
  const fixed = [find("club-home"), recruitingItem, find("meetings"), find("members")].filter((item): item is ProductNavItem => !!item)
  const fallback = ["tasks", "announcements", "settings"].map(find).filter((item): item is ProductNavItem => !!item)
  return [...fixed, ...fallback].slice(0, 4)
}
