import { hasPermission, type ClubAccess } from "@/lib/permissions"
export type PersonalSection = "discover" | "categories" | "calendar" | "applications" | "interviews" | "decisions" | "clubs" | "meetings" | "tasks"
export type ProductNavItem = { id: string; label: string; href?: string; quiet?: boolean; preview?: boolean }
export const personalNavigation: Record<string, ProductNavItem[]> = {
  explore: [{ id: "discover", label: "Discover" }, { id: "categories", label: "Categories" }, { id: "calendar", label: "Calendar" }],
  applications: [{ id: "applications", label: "All Applications" }, { id: "interviews", label: "Interviews" }, { id: "decisions", label: "Decisions" }],
  clubs: [{ id: "clubs", label: "Overview" }, { id: "meetings", label: "Meetings" }, { id: "tasks", label: "Tasks" }],
}
export function personalMode(section: PersonalSection) {
  return ["clubs", "meetings", "tasks"].includes(section) ? "clubs" : ["applications", "interviews", "decisions"].includes(section) ? "applications" : "explore"
}
export function managerNavigation(member: ClubAccess, clubId: string, mode: string): ProductNavItem[] {
  const href = (section: string, tool?: string) => `/club/${encodeURIComponent(clubId)}/workspace?section=${section}${tool ? `&tool=${tool}` : ""}`
  const item = (id: string, label: string, section = id, extra = {}) => ({ id, label, href: href(section, section === "recruitment" ? id : undefined), ...extra })
  if (mode === "recruiting") {
    const read = hasPermission(member, "applications.review") || hasPermission(member, "applicants.identify")
    return [item("overview", "Overview", "recruitment"),
      ...(read ? [item("applicants", "Applicants", "recruitment")] : []),
      ...(hasPermission(member, "applications.review") || hasPermission(member, "interviews.manage") ? [item("interviews", "Interviews", "recruitment")] : []),
      ...(read ? [item("decisions", "Decisions", "recruitment")] : []),
      ...(hasPermission(member, "recruitment.manage") ? [item("rounds", "Anonymous Review", "recruitment", { quiet: true }), item("rules", "Auto-Reject Rules", "recruitment", { quiet: true, preview: true })] : [])]
  }
  return [item("overview", "Overview"), item("meetings", "Meetings"), item("tasks", "Tasks"),
    ...(hasPermission(member, "members.manage") || hasPermission(member, "leaders.manage") ? [item("members", "Members")] : []),
    ...(hasPermission(member, "meetings.manage") ? [item("announcements", "Announcements", "announcements", { preview: true })] : []),
    ...(hasPermission(member, "club.settings") ? [item("settings", "Settings")] : [])]
}
/** Shared by links, buttons and workspace selects; domain forms retain their own guards. */
export function canLeaveWorkspace() {
  if (document.querySelector('[data-saving="true"]')) return false
  return !document.querySelector('[data-unsaved="true"]') || window.confirm("Leave this page? Your unsaved changes will be lost.")
}
