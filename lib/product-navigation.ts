import { interviewCapabilities } from "@/lib/interview-access"
import { availableSettings } from "@/lib/club-settings"
import { hasPermission, isActiveMembership, type ClubAccess } from "@/lib/permissions"
import { clubCalendarHref } from "@/lib/club-calendar"
import { decisionsHref } from "@/lib/voting-navigation"
import { applicantInterviewHref } from "@/lib/applicant-interview-navigation"
export type PersonalSection = "explore" | "categories" | "corkboard" | "calendar" | "applications" | "status" | "clubs" | "meetings" | "tasks"
export type PersonalMode = "explore" | "apply" | "clubs"
export type ProductNavItem = { id: string; label: string; href?: string; preview?: boolean; mode?: "recruiting" | "club"
  /** A page the workspace can show that has no rail, phone-bar or More entry (it is reached from inside another page). */
  hidden?: boolean
  /** Other item ids this destination stands for (the phone bar's Recruiting; Applicants for its record pages). */ matches?: string[] }
const personalNavigation: Record<PersonalMode, ProductNavItem[]> = {
  explore: [{ id: "explore", label: "Explore" }, { id: "corkboard", label: "Events" }],
  apply: [{ id: "applications", label: "Applications" }, { id: "status", label: "Applications" }],
  clubs: [{ id: "clubs", label: "Clubs" }, { id: "meetings", label: "Meetings" }, { id: "tasks", label: "Tasks" }],
}
export function personalItems(mode: PersonalMode): ProductNavItem[] { return personalNavigation[mode] }
export function personalMode(section: PersonalSection): PersonalMode {
  return ["clubs", "meetings", "tasks"].includes(section) ? "clubs" : ["applications", "status"].includes(section) ? "apply" : "explore"
}
export function personalDestination(id: string): { view: import("@/lib/views").ViewId; section?: PersonalSection } {
  if (["student-dashboard", "calendar", "inbox", "student-profile"].includes(id)) return { view: id as import("@/lib/views").ViewId }
  if (id === "apply" || id === "applications") return { view: "tracker", section: "applications" }
  if (id === "status") return { view: "status", section: "status" }
  if (["clubs", "meetings", "tasks"].includes(id)) return { view: "my-clubs", section: id as PersonalSection }
  if (id === "corkboard") return { view: id, section: id }
  return { view: "explore", section: "explore" }
}
/**
 * The club workspace's destinations for one mode. Every surface (rail, phone bar, More, Cmd-K, page titles and the
 * workspace's own "is this allowed" check) reads this list, so permissions are decided once.
 * Recruiting: Overview · Applicants · Interviews · Decide. Club: Home · Calendar · Tasks · Members · Settings.
 * Anonymous Review and Auto-Reject Rules are no longer destinations: they are sections of the Recruiting settings
 * drawer (lib/recruiting-settings), opened from Applicants and from club Settings.
 */
export function managerNavigation(member: ClubAccess, clubId: string, mode: string, search = ""): ProductNavItem[] {
  const href = (section: string, tool?: string) => `/club/${encodeURIComponent(clubId)}/workspace?section=${section}${tool ? `&tool=${tool}` : ""}`
  const item = (id: string, label: string, section = id, extra = {}) => ({ id, label, href: href(section, section === "recruitment" ? id : undefined), ...extra })
  if (mode === "recruiting") {
    const read = hasPermission(member, "applications.review") || hasPermission(member, "applicants.identify")
    const { canVote, canSend } = decideAccess(member)
    return [item("overview", "Overview", "recruitment"),
      ...(read ? [item("applicants", "Applicants", "recruitment", { matches: ["resumes", "reviews"] })] : []),
      // Interview records are Applicants pages: linked from its toolbar and from each dossier, not from the rail.
      ...(interviewCapabilities(member).moderateResume ? [item("resumes", "Résumé moderation", "recruitment", { hidden: true, href: applicantInterviewHref(clubId, "resumes", search) })] : []),
      ...(interviewCapabilities(member).readClosing ? [item("reviews", "Submitted reviews", "recruitment", { hidden: true, href: applicantInterviewHref(clubId, "reviews", search) })] : []),
      // Interview participants reach kits here (Settings no longer repeats the Interviews tool).
      ...(hasPermission(member, "applications.review") || hasPermission(member, "interviews.manage") || hasPermission(member, "recruitment.manage") || interviewCapabilities(member).editKit || interviewCapabilities(member).participate ? [item("interviews", "Interviews", "recruitment")] : []),
      // Decide keeps the internal `tool=decisions` value; it opens on Overview, then Vote (decisionTab=voting) and Send (decisionTab=letters).
      ...(canVote || canSend ? [item("decisions", "Decide", "recruitment", { href: decisionsHref(clubId, "overview", search) })] : []),
      ...(availableSettings(member).length ? [item("settings", "Settings")] : [])]
  }
  return [item("overview", "Home"),
    item("calendar", "Calendar"),
    item("tasks", "Tasks"),
    ...(hasPermission(member, "members.manage") || hasPermission(member, "leaders.manage") ? [item("members", "Members")] : []),
    ...(availableSettings(member).length ? [item("settings", "Settings")] : [])]
}

/**
 * Cmd-K entries for a club's Meetings, Events and Members, with the gates their pages use: Meetings is the Calendar's
 * meetings filter (every active member), Events needs meetings.manage (ClubCalendar shows members only meetings), and
 * Members uses managerNavigation's own gate. A former member gets none.
 */
export function clubSearchLinks(member: ClubAccess | null | undefined, clubId: string): { id: string; title: string; href: string }[] {
  if (!clubId || !isActiveMembership(member)) return []
  return [
    { id: "club-search-meetings", title: "Meetings", href: clubCalendarHref(clubId, "meetings") },
    ...(hasPermission(member, "meetings.manage") ? [{ id: "club-search-events", title: "Events", href: clubCalendarHref(clubId, "events") }] : []),
    ...managerNavigation(member!, clubId, "club").filter(item => item.id === "members").map(item => ({ id: "club-search-members", title: item.label, href: item.href! })),
  ]
}

/** Who can open Decide and which of its steps. Unchanged from the old Decisions + Scheduled Decisions gates. */
export function decideAccess(member: ClubAccess | null | undefined) {
  const canVote = hasPermission(member, "applications.review") && (["decisions.start", "decisions.vote", "decisions.view"] as const).some(p => hasPermission(member, p))
  const canLetters = hasPermission(member, "recruitment.manage") || hasPermission(member, "decisions.manage")
  const canScheduled = (hasPermission(member, "decisions.manage") || hasPermission(member, "decisions.publish")) && hasPermission(member, "applicants.identify")
  return { canVote, canLetters, canScheduled, canSend: canLetters || canScheduled }
}

/** Shared by links, buttons and workspace selects; domain forms retain their own guards. */
export function canLeaveWorkspace(retained?: HTMLElement | null) {
  // A retained editor is not leaving the page. Continue guarding other forms.
  if (retained) {
    if ([...document.querySelectorAll('[data-saving="true"]')].some(node => !retained.contains(node))) return false
    return ![...document.querySelectorAll('[data-unsaved="true"]')].some(node => !retained.contains(node)) || window.confirm("Leave this page? Your unsaved changes will be lost.")
  }
  if (document.querySelector('[data-saving="true"]')) return false
  return !document.querySelector('[data-unsaved="true"]') || window.confirm("Leave this page? Your unsaved changes will be lost.")
}

/** Destinations that get their own entry on the phone (rail pages, not pages reached from inside one). */
export function mobileDestinations(items: ProductNavItem[]) {
  return items.filter(item => !item.hidden)
}
