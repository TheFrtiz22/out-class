import { TERMS } from "@/lib/copy/terms"
import { RECRUITING_SETTINGS_PARAM } from "@/lib/recruiting-settings"

/**
 * Club workspace URL helpers that need no UI imports, so the server page,
 * middleware-free redirects and tests share one mapping.
 */
type Query = URLSearchParams | Record<string, string | string[] | undefined>
function read(query: Query, key: string) {
  if (query instanceof URLSearchParams) return query.get(key)
  const value = query[key]
  return (Array.isArray(value) ? value[0] : value) ?? null
}

const sectionTitles: Record<string, string> = {
  overview: "Home", calendar: "Calendar", meetings: "Calendar", events: "Calendar", tasks: TERMS.tasks, members: "Members",
  announcements: "Home", settings: "Settings",
}
const toolTitles: Record<string, string> = {
  overview: TERMS.recruiting, applicants: TERMS.applicants, rejected: TERMS.applicants, interviews: "Interviews", decisions: "Decide",
  "scheduled-decisions": "Decide", resumes: "Résumé moderation", reviews: "Submitted reviews",
  rounds: TERMS.applicants, rules: TERMS.applicants,
}

/** The `<title>` text (before " · OutClass") for a club workspace URL. */
export function clubWorkspaceTitle(query: Query) {
  const section = read(query, "section") || "overview"
  if (section !== "recruitment") return sectionTitles[section] ?? "Club workspace"
  const tool = read(query, "tool") || "applicants"
  return toolTitles[tool] ?? TERMS.recruiting
}

/**
 * Old club workspace query values and where they live now. Returns the canonical query
 * (every other parameter carried over), or null when the URL is already canonical.
 * Used by the server page (redirect) and the client workspace (replace), so links in
 * stored notifications and sent email keep working.
 */
export function canonicalClubWorkspaceQuery(input: URLSearchParams): URLSearchParams | null {
  const q = new URLSearchParams(input)
  const section = q.get("section"), tool = q.get("tool")
  let changed = false
  const set = (key: string, value: string | null) => { if (value === null) q.delete(key); else q.set(key, value); changed = true }
  // Club events have their own section (owner decision 2026-11-05, FE-12); the old Meetings tab redirects there.
  if (section === "meetings" && q.get("meetingTab") === "events") { set("section", "events"); set("meetingTab", null) }
  if (section === "recruitment") {
    // Configuration moved to Settings.
    if (tool === "cycles") { set("section", "settings"); set("setting", "cycles"); set("tool", null) }
    // Voting and letters used to be tools; they are Decisions tabs.
    if (tool === "voting") { set("tool", "decisions"); set("decisionTab", "voting") }
    if (tool === "letters" || tool === "decision-letters") { set("tool", "decisions"); set("decisionTab", "letters") }
    // Scheduled Decisions was its own page; scheduled sends live in Decide's Send step.
    if (tool === "scheduled-decisions") { set("tool", "decisions"); set("decisionTab", "letters") }
    // Anonymous Review and Auto-Reject Rules were rail drawers; they are sections of the Recruiting settings drawer on Applicants.
    if (tool === "rounds" || tool === "rules") { set("tool", "applicants"); set(RECRUITING_SETTINGS_PARAM, tool === "rounds" ? "anonymous" : "rules") }
    // Rejected Applicants is the Applicants list filtered to Rejected.
    if (tool === "rejected") { set("tool", "applicants"); set("decision", "rejected") }
    // Decisions → Overview is the Applicants decision filter.
    if (q.get("tool") === "decisions" && q.get("decisionTab") === "overview") { set("tool", "applicants"); set("decisionTab", null) }
    // The board ballot opens from the Voting room, not from Applicants.
    if ((q.get("tool") ?? "applicants") === "applicants" && q.get("voting") === "1") { set("tool", "decisions"); set("decisionTab", "voting"); set("voting", null) }
  }
  // Settings → Interviews re-rendered the Interviews tool; every tab now lives there (kits by default).
  if (section === "settings" && q.get("setting") === "interviews") {
    set("section", "recruitment"); set("tool", "interviews"); set("setting", null)
    set("interviewTab", q.get("interviewTab") === "availability" ? "schedule" : q.get("interviewTab") || "kits")
  }
  return changed ? q : null
}
export function canonicalClubWorkspaceHref(clubId: string, input: URLSearchParams) {
  const q = canonicalClubWorkspaceQuery(input)
  return q ? `/club/${encodeURIComponent(clubId)}/workspace?${q}` : null
}
