import { clubWorkspaceHref, recruitmentTools } from "@/lib/club-workspace"
import { hasWorkspace, type ClubAccess } from "@/lib/permissions"

export type ClubWorkspaceMode = "recruiting" | "club"

/** Preferences belong to one account and club; demo/preview never change live choices. */
export function clubWorkspacePreferenceKey(userId: string, clubId: string, context: "live" | "demo" | "preview") {
  return `outclass:club-workspace:v1:${context}:${encodeURIComponent(userId)}:${encodeURIComponent(clubId)}`
}

export function readClubWorkspacePreference(key: string): ClubWorkspaceMode | null {
  try {
    const value = localStorage.getItem(key)
    return value === "recruiting" || value === "club" ? value : null
  } catch { return null }
}

export function saveClubWorkspacePreference(key: string, mode: ClubWorkspaceMode) {
  try { localStorage.setItem(key, mode) } catch { /* Navigation still works when storage is blocked. */ }
}

export function clubWorkspaceEntryHref(clubId: string, member: ClubAccess, preference: ClubWorkspaceMode | null) {
  const recruiting = hasWorkspace(member) && recruitmentTools(member).length > 0 && preference !== "club"
  return recruiting ? `${clubWorkspaceHref(clubId, "recruitment")}&tool=overview` : clubWorkspaceHref(clubId, "overview")
}
