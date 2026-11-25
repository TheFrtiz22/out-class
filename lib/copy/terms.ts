/**
 * One name per concept. User-visible labels for navigation, page titles, ⌘K entries and
 * the buttons that lead to them read from here, so a rename happens in one place.
 * Internal ids, enum values and URL query values keep their existing names.
 */
export const TERMS = {
  /** Club broadcast posts. Not "Post update", "Club updates" or "Messages". */
  announcements: "Announcements",
  newAnnouncement: "New announcement",
  /** Create actions read "New …", with the Plus icon, never a typed "+". */
  newMeeting: "New meeting",
  newEvent: "New event",
  /** Personal notification feed. Not "Notifications" or "Updates for you". */
  inbox: "Inbox",
  openInbox: "Open inbox",
  /** Club work items. Not "assignments". */
  tasks: "Tasks",
  yourTasks: "Your tasks",
  teamTasks: "Team tasks",
  createTask: "Create task",
  /** Every link into interview scheduling, always to the Schedule tab. */
  scheduleInterviews: "Schedule interviews",
  /**
   * Interviews has one word per thing: a Room is a place with its time slots and interviewers,
   * the people asking are Interviewers, what they ask is Questions, and the student is the Applicant.
   * Tab URL values stay rooms / schedule / kits.
   */
  interviewRoom: "Interview room",
  myInterviewsTab: "My interviews",
  scheduleTab: "Schedule",
  questionsTab: "Questions",
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
  /** The recruiting Overview page in the rail and the document title; its H1 stays "Recruiting". */
  recruitingOverview: "Recruiting overview",
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

/** A member's club title, or their legacy role in words ("General member", not "GENERAL MEMBER"). */
export const memberRoleTitles: Record<string, string> = { PRESIDENT: "President", RECRUITMENT_LEAD: "Recruitment lead", GENERAL_MEMBER: "General member" }
export function memberTitleLabel(member: { title?: string | null; role: string }) {
  if (member.title?.trim()) return member.title.trim()
  return memberRoleTitles[member.role] ?? member.role.charAt(0) + member.role.slice(1).toLowerCase().replaceAll("_", " ")
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
