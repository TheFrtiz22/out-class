import { interviewCapabilities } from "@/lib/interview-access"
import { availableSettings } from "@/lib/club-settings"
import { hasPermission, type ClubAccess } from "@/lib/permissions"
export type PersonalSection = "explore" | "categories" | "corkboard" | "calendar" | "applications" | "status" | "clubs" | "meetings" | "tasks"
export type PersonalMode = "explore" | "apply" | "clubs"
export type ProductNavItem = { id: string; label: string; href?: string; quiet?: boolean; preview?: boolean }
export const personalModes: ProductNavItem[] = [
  { id: "explore", label: "Explore" }, { id: "apply", label: "Apply" }, { id: "clubs", label: "My Clubs" },
]
export const personalUniversalItems: ProductNavItem[] = [
  { id: "student-dashboard", label: "Home" },
  { id: "inbox", label: "Notifications" },
  { id: "student-profile", label: "Profile" },
]
const personalNavigation: Record<PersonalMode, ProductNavItem[]> = {
  explore: [{ id: "explore", label: "Discover" }, { id: "corkboard", label: "Corkboard" }],
  apply: [{ id: "applications", label: "Applications" }, { id: "status", label: "Status" }, { id: "calendar", label: "Calendar" }],
  clubs: [{ id: "clubs", label: "Clubs" }, { id: "meetings", label: "Meetings" }, { id: "tasks", label: "Tasks" }],
}
export function personalItems(mode: PersonalMode): ProductNavItem[] { return personalNavigation[mode] }
export function personalMode(section: PersonalSection): PersonalMode {
  return ["clubs", "meetings", "tasks"].includes(section) ? "clubs" : ["applications", "status", "calendar"].includes(section) ? "apply" : "explore"
}
export function personalDestination(id: string): { view: import("@/lib/views").ViewId; section?: PersonalSection } {
  if (["student-dashboard", "inbox", "student-profile"].includes(id)) return { view: id as import("@/lib/views").ViewId }
  if (id === "apply" || id === "applications") return { view: "tracker", section: "applications" }
  if (id === "status") return { view: "status", section: "status" }
  if (["clubs", "meetings", "tasks"].includes(id)) return { view: "my-clubs", section: id as PersonalSection }
  if (id === "calendar" || id === "corkboard") return { view: id, section: id }
  return { view: "explore", section: "explore" }
}
export function managerNavigation(member: ClubAccess, clubId: string, mode: string): ProductNavItem[] {
  const href = (section: string, tool?: string) => `/club/${encodeURIComponent(clubId)}/workspace?section=${section}${tool ? `&tool=${tool}` : ""}`
  const item = (id: string, label: string, section = id, extra = {}) => ({ id, label, href: href(section, section === "recruitment" ? id : undefined), ...extra })
  if (mode === "recruiting") {
    const read = hasPermission(member, "applications.review") || hasPermission(member, "applicants.identify")
    return [item("overview", "Overview", "recruitment"),
      ...(read ? [item("applicants", "Applicants", "recruitment")] : []),
      ...(hasPermission(member, "applications.review") || hasPermission(member, "interviews.manage") || interviewCapabilities(member).editKit ? [item("interviews", "Interviews", "recruitment")] : []),
      ...(read ? [item("decisions", "Decisions", "recruitment")] : []),
      ...(hasPermission(member, "recruitment.manage") ? [item("rounds", "Anonymous Review", "recruitment", { quiet: true }), item("rules", "Auto-Reject Rules", "recruitment", { quiet: true })] : [])]
  }
  return [item("overview", "Overview"), item("meetings", "Meetings"), item("tasks", "Tasks"),
    ...(hasPermission(member, "members.manage") || hasPermission(member, "leaders.manage") ? [item("members", "Members")] : []),
    ...(hasPermission(member, "meetings.manage") ? [item("announcements", "Announcements", "announcements")] : []),
    ...(availableSettings(member).length ? [item("settings", "Appearance")] : [])]
}
/** Shared by links, buttons and workspace selects; domain forms retain their own guards. */
export function canLeaveWorkspace() {
  if (document.querySelector('[data-saving="true"]')) return false
  return !document.querySelector('[data-unsaved="true"]') || window.confirm("Leave this page? Your unsaved changes will be lost.")
}
