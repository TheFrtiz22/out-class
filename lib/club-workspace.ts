import { availableSettings } from "@/lib/club-settings"
import { hasPermission, type ClubAccess } from "@/lib/permissions";
export const clubSections = [
  "overview",
  "members",
  "meetings",
  "events",
  "tasks",
  "recruitment",
  "settings",
] as const;
export type ClubSection = (typeof clubSections)[number];
export function clubWorkspaceSections(
  member: ClubAccess | null | undefined,
): ClubSection[] {
  if (!member) return [];
  return clubSections.filter((section) => {
    if (section === "events") return hasPermission(member, "meetings.manage");
    if (section === "members")
      return (
        hasPermission(member, "members.manage") ||
        hasPermission(member, "leaders.manage")
      );
    if (section === "settings") return availableSettings(member).length > 0;
    if (section === "recruitment") return recruitmentTools(member).length > 0;
    return true;
  });
}
export function recruitmentTools(member: ClubAccess) {
  const tools: {
    id: "applicants" | "rounds" | "interviews" | "kits";
    label: string;
  }[] = [];
  if (
    hasPermission(member, "applicants.identify") ||
    hasPermission(member, "applications.review")
  )
    tools.push({ id: "applicants", label: "Applicants & decisions" });
  if (hasPermission(member, "recruitment.manage"))
    tools.push({ id: "rounds", label: "Round settings" });
  if (hasPermission(member, "applications.review"))
    tools.push({ id: "interviews", label: "Interview mode" });
  if (hasPermission(member, "interviews.manage"))
    tools.push({ id: "kits", label: "Interview kits & scheduling" });
  return tools;
}
export const clubSectionLabels: Record<ClubSection, string> = {
  overview: "Overview",
  members: "Members",
  meetings: "Meetings",
  events: "Events",
  tasks: "Tasks",
  recruitment: "Recruitment",
  settings: "Settings",
};
export function clubWorkspaceHref(
  clubId: string,
  section: ClubSection = "overview",
) {
  return `/club/${encodeURIComponent(clubId)}/workspace${section === "overview" ? "" : `?section=${section}`}`;
}
