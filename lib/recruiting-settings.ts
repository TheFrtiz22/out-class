import { hasPermission, type ClubAccess } from "@/lib/permissions"

/**
 * The Recruiting settings drawer (Anonymous review, Auto-reject rules, Grading). It used to be two rail items; it now opens
 * from the Applicants toolbar's gear and from club Settings → Application → Recruiting. The drawer is URL-driven
 * (`recruitingSettings=<section>`), so old `tool=rounds|rules` links, notifications and the browser's Back button
 * all reach it. Kept free of UI imports so the server page, redirects and tests share it.
 */
export const RECRUITING_SETTINGS_PARAM = "recruitingSettings"
export const recruitingSettingsSections = [
  { id: "anonymous", label: "Anonymous review", description: "Round privacy and requirements for future submissions." },
  { id: "rules", label: "Auto-reject rules", description: "Saved round thresholds, applicant previews, and reversible review flags." },
  { id: "grading", label: "Grading", description: "The categories reviewers score applicants on, each on its own scale." },
] as const
export type RecruitingSettingsSection = typeof recruitingSettingsSections[number]["id"]

export function recruitingSettingsSection(value: string | null | undefined): RecruitingSettingsSection | null {
  return recruitingSettingsSections.some(section => section.id === value) ? value as RecruitingSettingsSection : null
}

/** Same gate the two rail drawers had: recruitment managers only. */
export function canOpenRecruitingSettings(member: ClubAccess | null | undefined) {
  return hasPermission(member, "recruitment.manage")
}

/** The current page with the drawer open on `section` (every other parameter kept). */
export function withRecruitingSettings(search: string | URLSearchParams, section: RecruitingSettingsSection | null) {
  const q = new URLSearchParams(search)
  if (section) q.set(RECRUITING_SETTINGS_PARAM, section)
  else q.delete(RECRUITING_SETTINGS_PARAM)
  return q
}

/** Applicants with the drawer open: where old Anonymous Review / Auto-Reject links land. */
export function recruitingSettingsHref(clubId: string, section: RecruitingSettingsSection = "anonymous") {
  return `/club/${encodeURIComponent(clubId)}/workspace?section=recruitment&tool=applicants&${RECRUITING_SETTINGS_PARAM}=${section}`
}
