import { managerNavigation } from "@/lib/product-navigation"
import { clubSearchLinks } from "@/lib/product-navigation"
import { adminNavigation } from "@/lib/admin-navigation"
import { hasWorkspace, isActiveMembership, type ClubAccess } from "@/lib/permissions"
import { INBOX_HREF, TERMS } from "@/lib/copy/terms"
import { notificationSettingsHref } from "@/lib/settings-navigation"

/** A page anywhere in OutClass that Cmd-K can open, with the workspace it belongs to. */
export type SearchDestination = { id: string; title: string; href: string; scope: string; keywords?: string }
export type SearchMembership = ClubAccess & { clubId: string; club?: { name?: string | null } | null }

/**
 * Every page the account can open, across every workspace, built from the same navigation lists the rail uses so
 * search never offers a page the shell would refuse. Personal pages always; each club's pages by that membership's
 * permissions (a workspace for leaders, Home · Meetings · Tasks for members); the platform pages only for admins.
 * Presentation only: server actions and routes still authorize every page and record.
 */
export function searchDestinations({ memberships = [], admin = false, settings = true }: { memberships?: readonly SearchMembership[]; admin?: boolean; settings?: boolean }): SearchDestination[] {
  const personal = "Personal"
  const pages: SearchDestination[] = [
    { id: "home", title: "Home", href: "/home", scope: personal },
    { id: "explore", title: "Explore", href: "/explore", scope: personal, keywords: "clubs discover browse" },
    { id: "corkboard", title: TERMS.events, href: "/corkboard", scope: personal, keywords: "corkboard" },
    { id: "applications", title: "Applications", href: "/applications", scope: personal, keywords: "status tracker" },
    { id: "clubs", title: TERMS.myClubs, href: "/clubs", scope: personal },
    { id: "calendar", title: "Calendar", href: "/calendar", scope: personal },
    { id: "inbox", title: TERMS.inbox, href: INBOX_HREF, scope: personal, keywords: "notifications messages" },
    { id: "profile", title: "Profile", href: "/profile", scope: personal, keywords: "resume account" },
    ...(settings ? [
      { id: "settings", title: "Settings", href: "/settings", scope: personal, keywords: "account" },
      { id: "notification-settings", title: "Notification settings", href: notificationSettingsHref, scope: personal, keywords: "email preferences" },
    ] : []),
  ]
  for (const member of memberships) {
    if (!member.clubId || !isActiveMembership(member)) continue
    const scope = member.club?.name?.trim() || "Club"
    const root = `/club/${encodeURIComponent(member.clubId)}/workspace`
    const add = (id: string, title: string, href: string, keywords?: string) => pages.push({ id: `club-${member.clubId}-${id}`, title, href, scope, keywords: [scope, keywords].filter(Boolean).join(" ") })
    if (hasWorkspace(member)) {
      // Recruiting first (Overview is named Recruiting there), then Club; hidden pages such as Résumé moderation too.
      for (const item of managerNavigation(member, member.clubId, "recruiting")) add(`recruiting-${item.id}`, item.id === "overview" ? TERMS.recruiting : item.label, item.href!, "recruiting")
      for (const item of managerNavigation(member, member.clubId, "club")) add(`club-${item.id}`, item.id === "overview" ? "Club home" : item.label, item.href!, "club")
    } else {
      add("home", "Club home", `${root}?section=overview`)
      add("tasks", "Tasks", `${root}?section=tasks`)
    }
    for (const link of clubSearchLinks(member, member.clubId)) add(link.id, link.title, link.href)
  }
  if (admin) for (const item of adminNavigation) pages.push({ id: `platform-${item.id}`, title: item.label, href: item.href!, scope: "Platform admin", keywords: `admin platform ${item.group}` })
  // One entry per address (Settings appears in both a club's recruiting and club lists).
  const seen = new Set<string>()
  return pages.filter(page => !seen.has(page.href) && !!seen.add(page.href))
}

/** Case-insensitive, every word must appear in the title, workspace or keywords ("decide chess" finds Chess Club's Decide). */
export function matchDestinations(pages: readonly SearchDestination[], query: string, limit = 12): SearchDestination[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const scored = pages.flatMap(page => {
    const title = page.title.toLowerCase(), haystack = `${title} ${page.scope.toLowerCase()} ${page.keywords?.toLowerCase() ?? ""}`
    if (!words.every(word => haystack.includes(word))) return []
    // Title matches outrank workspace-only matches; a title that starts with the query ranks highest.
    const score = (title.startsWith(words[0]) ? 0 : words.some(word => title.includes(word)) ? 1 : 2)
    return [{ page, score }]
  })
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map(entry => entry.page)
}
