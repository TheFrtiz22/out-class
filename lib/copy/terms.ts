/**
 * One name per concept. User-visible labels for navigation, page titles, ⌘K entries and
 * the buttons that lead to them read from here, so a rename happens in one place.
 * Internal ids, enum values and URL query values keep their existing names.
 */
export const TERMS = {
  /** Club broadcast posts. Not "Post update", "Club updates" or "Messages". */
  announcements: "Announcements",
  newAnnouncement: "New announcement",
  /** Personal notification feed. Not "Notifications" or "Updates for you". */
  inbox: "Inbox",
  openInbox: "Open inbox",
  /** Club work items. Not "assignments". */
  tasks: "Tasks",
  yourTasks: "Your tasks",
  teamTasks: "Team tasks",
  createTask: "Create task",
  /** Every link into interview scheduling, always to the Scheduling tab. */
  scheduleInterviews: "Schedule interviews",
  /** The live interview page. The Interviews tab that lists rooms is "Rooms". */
  interviewRoom: "Interview room",
  roomsTab: "Rooms",
  /** Every link into voting goes to the Voting room. Session rows say "Open session". */
  openVoting: "Open voting",
  openSession: "Open session",
  votingRoom: "Voting room",
  startVotingSession: "Start voting session",
  /** Groups a user belongs to. Not "Organizations" in user-facing copy. */
  clubs: "Clubs",
  myClubs: "My Clubs",
  /** The club directory. Not "Discover". */
  explore: "Explore",
  /** Campus events board (route /corkboard). */
  events: "Events",
  browseEvents: "Browse events",
  recruiting: "Recruiting",
  clubHome: "Club home",
  applicants: "Applicants",
  publicProfile: "Public profile",
} as const

export const BROWSE_EVENTS_HREF = "/corkboard"
export const INBOX_HREF = "/inbox"

/** The same role label everywhere a member's club role is shown (My Clubs, Settings, Members). */
export const membershipRoleLabels = {
  OWNER: "Owner", ADMIN: "Admin", RECRUITING_ADMIN: "Recruiting Lead", INTERVIEWER: "Interviewer", MEMBER: "Member",
} as const
export type MembershipRole = keyof typeof membershipRoleLabels
export function membershipRoleLabel(member: { accessRole?: string | null; isOwner?: boolean | null }) {
  if (member.isOwner) return membershipRoleLabels.OWNER
  return membershipRoleLabels[(member.accessRole ?? "MEMBER") as MembershipRole] ?? membershipRoleLabels.MEMBER
}

/**
 * "1 applicant", "2 applicants". Pass the plural when it is not the singular plus "s".
 * `pluralize(3, "result")` → "3 results"; `pluralize(1, "class", "classes")` → "1 class".
 */
export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`
}
/** The word alone, for sentences where the number is rendered separately. */
export function plural(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural
}

/** Short date and time without seconds: "Oct 21, 2026, 5:06 PM". */
export function formatDateTime(value: string | number | Date, options: { timeZone?: string } = {}) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", ...(options.timeZone ? { timeZone: options.timeZone } : {}) })
}

/** "Oct 21" for list rows ("Oct 21, 2025" outside the current year), in the given zone. */
export function formatShortDate(value: string | number | Date, options: { timeZone?: string } = {}) {
  const date = new Date(value), zone = options.timeZone ? { timeZone: options.timeZone } : {}
  const year = (d: Date) => d.toLocaleString("en-US", { year: "numeric", ...zone })
  return date.toLocaleString("en-US", { month: "short", day: "numeric", ...(year(date) === year(new Date()) ? {} : { year: "numeric" }), ...zone })
}

/** `<title>` text for a page: "Inbox · OutClass". The root layout's template adds the suffix. */
export const TITLE_SUFFIX = " · OutClass"
export function documentTitle(title: string) {
  return `${title}${TITLE_SUFFIX}`
}
