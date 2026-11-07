import { TERMS } from "@/lib/copy/terms"

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
  overview: TERMS.clubHome, meetings: "Meetings", events: "Meetings", tasks: TERMS.tasks, members: "Members",
  announcements: TERMS.announcements, settings: "Settings",
}
const toolTitles: Record<string, string> = {
  overview: TERMS.recruiting, applicants: TERMS.applicants, rejected: TERMS.applicants, interviews: "Interviews", decisions: "Decisions",
  "scheduled-decisions": "Scheduled Decisions", resumes: "Résumé moderation", reviews: "Submitted reviews",
  rounds: "Anonymous Review", rules: "Auto-Reject Rules",
}

/** The `<title>` text (before " · OutClass") for a club workspace URL. */
export function clubWorkspaceTitle(query: Query) {
  const section = read(query, "section") || "overview"
  if (section !== "recruitment") return sectionTitles[section] ?? "Club workspace"
  const tool = read(query, "tool") || "applicants"
  if (tool === "decisions" && read(query, "decisionTab") === "letters") return "Decision letters"
  if (tool === "decisions" && read(query, "decisionTab") !== "overview") return TERMS.votingRoom
  return toolTitles[tool] ?? TERMS.recruiting
}
