import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { hasPermission, type ClubAccess } from "@/lib/permissions"
import { leaderRailSections, railItems } from "@/lib/navigation"
import { anonymousApplicantLabel } from "@/lib/anonymous-review"
import { TERMS } from "@/lib/copy/terms"
import { votingSessionHref, votingStateLabel } from "@/lib/voting-navigation"

/** Pure view model for Club home. Reads only the overview the server already authorized. */
export type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
type Booking = Overview["operations"]["bookings"][number]

const DAY = 86_400_000
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Hrefs come only from the rail, so the rail highlight follows every dashboard link. */
export function railHrefs(member: ClubAccess, clubId: string) {
  const items = railItems(leaderRailSections(member, clubId))
  const href = (id: string) => items.find(item => item.id === id)?.href ?? null
  return {
    applicants: href("applicants"), interviews: href("interviews"), decisions: href("decisions"),
    // Calendar filtered to meetings (New meeting adds `&new=1`).
    meetings: href("calendar") ? `${href("calendar")}&type=meetings` : null, tasks: href("tasks"), members: href("members"),
    // Announcements live on Home (its own section, scrolled to by `focus=announcements`); posting needs meetings.manage.
    announcements: hasPermission(member, "meetings.manage") && href("club-home") ? `${href("club-home")}&focus=announcements` : null,
    // The Recruiting Overview; only members with a recruiting tool have one.
    recruiting: items.find(item => item.id === "overview" && item.mode === "recruiting")?.href ?? null,
  }
}
export type RailHrefs = ReturnType<typeof railHrefs>

/**
 * Applicants filtered to the round with the most reviews left for you, with quick review open on the first one you
 * haven't reviewed (`quickReview=1`, handled by the Applicants workspace). Ties go to the earlier round.
 */
export function quickReviewHref(applicants: string, rounds: { id: string; pending: number }[]) {
  const busiest = rounds.reduce<{ id: string; pending: number } | null>((best, round) => round.pending > (best?.pending ?? 0) ? round : best, null)
  return `${applicants}${busiest ? `&roundId=${encodeURIComponent(busiest.id)}` : ""}&quickReview=1`
}

export type NeedsAction =
  | { kind: "link"; href: string; label: string }
  | { kind: "task"; label: string; taskId: string; assignmentId: string; title: string; review?: boolean }
  | { kind: "meeting"; label: string; meetingId: string; title: string }
  | { kind: "applicant"; label: string; applicationId: string }
export type NeedsCard = { id: string; priority: number; title: string; detail: string; progress?: { done: number; total: number }; action: NeedsAction }

export function isOverdue(due: Date | string | null | undefined, now: number) {
  return !!due && +new Date(due) < now
}

/**
 * Club home "Needs you": running the club, never recruiting. 2–4 cards, most urgent first; each needs
 * the permission its data and destination need (the overview only carries data the member may read).
 */
export function needsYou(data: Overview, hrefs: RailHrefs): NeedsCard[] {
  const { operations: op, membership: m } = data
  const now = +new Date(op.asOf)
  const cards: NeedsCard[] = []
  if (op.tasks.overdue > 0) {
    const first = data.work.find(w => isOverdue(w.task.dueAt, now))
    if (first || hrefs.tasks) cards.push({ id: "overdue", priority: 1, title: `${plural(op.tasks.overdue, "task")} overdue`, detail: first ? first.task.title : "Open your tasks to catch up.", action: first ? { kind: "task", label: "Open task", taskId: first.task.id, assignmentId: first.id, title: first.task.title } : { kind: "link", href: `${hrefs.tasks}&taskView=mine`, label: "Open tasks" } })
  }
  if (hasPermission(m, "tasks.manage") && (op.team?.overdue ?? 0) > 0 && hrefs.tasks) cards.push({ id: "team-overdue", priority: 2, title: `${plural(op.team!.overdue, "team task")} overdue`, detail: op.teamTasks.find(t => isOverdue(t.dueAt, now))?.title ?? "Follow up from Team tasks.", action: { kind: "link", href: `${hrefs.tasks}&taskView=team`, label: "Open team tasks" } })
  const submission = op.reviewWork[0]
  if (hasPermission(m, "tasks.manage") && (op.tasks.awaitingReview ?? 0) > 0 && submission) cards.push({ id: "submissions", priority: 3, title: `${plural(op.tasks.awaitingReview!, "submission")} waiting for feedback`, detail: submission.task.title, action: { kind: "task", label: "Give feedback", taskId: submission.task.id, assignmentId: submission.id, title: submission.task.title, review: true } })
  const bare = hasPermission(m, "meetings.manage") ? op.meetings.find(meeting => +new Date(meeting.date) >= now && +new Date(meeting.date) <= now + 2 * DAY && !meeting.agenda?.trim()) : undefined
  if (bare) cards.push({ id: "agenda", priority: 4, title: "Next meeting has no agenda", detail: bare.title, action: { kind: "meeting", label: "Add agenda", meetingId: bare.id, title: bare.title } })
  const soon = data.work.find(w => !isOverdue(w.task.dueAt, now) && !!w.task.dueAt && +new Date(w.task.dueAt) <= now + 2 * DAY)
  if (soon) cards.push({ id: "due-soon", priority: 5, title: "A task is due soon", detail: soon.task.title, action: { kind: "task", label: "Open task", taskId: soon.task.id, assignmentId: soon.id, title: soon.task.title } })
  if ((data.members?.pendingInvitations ?? 0) > 0 && hrefs.members) cards.push({ id: "invitations", priority: 6, title: `${plural(data.members!.pendingInvitations, "invitation")} pending`, detail: "Members who have not joined yet", action: { kind: "link", href: hrefs.members, label: "Open members" } })
  return cards.sort((a, b) => a.priority - b.priority).slice(0, 4)
}

/**
 * Whether the club is recruiting now: a current cycle, applicants in a round, or an open intake with rounds
 * to receive them. Intake alone is not enough: clubs accept applications by default before any setup.
 */
export function recruitingActive(op: Overview["operations"]) {
  return op.cycles.length > 0 || op.rounds.some(round => round.count > 0) || !!op.intake?.applicationOpen && op.rounds.length > 0
}

export type RecruitingStrip = { open: boolean; applicants: number; attention: number; href: string }
/** Club home's one link to recruiting, only with recruiting access and an active cycle. */
export function recruitingStrip(data: Overview, hrefs: RailHrefs): RecruitingStrip | null {
  const op = data.operations
  if (!hrefs.recruiting || !recruitingActive(op)) return null
  const applicants = op.cycles.length ? op.cycles.reduce((n, c) => n + c.applicants, 0) : op.rounds.reduce((n, r) => n + r.count, 0)
  const scheduling = hasPermission(data.membership, "interviews.manage") ? op.rounds.reduce((n, r) => n + r.needsBooking, 0) : 0
  const attention = op.rounds.reduce((n, r) => n + r.pending, 0) + scheduling + op.votes.filter(v => v.state === "OPEN").length
  return { open: !!op.intake?.applicationOpen, applicants, attention, href: hrefs.recruiting }
}

/** Where a voting row opens: the join page for members not yet in the session, else the Voting room. */
export function voteHref(clubId: string, membership: Overview["membership"], vote: Overview["operations"]["votes"][number]) {
  return !vote.participants.length && !hasPermission(membership, "decisions.view") && !hasPermission(membership, "decisions.manage") ? `/voting/${vote.id}/join` : votingSessionHref(clubId, vote, hasPermission(membership, "decisions.start") ? "leader" : "member")
}
const voteComplete = (vote: Overview["operations"]["votes"][number]) => vote.state === "COMPLETE" || vote.state === "COMPLETED"

/**
 * Recruiting Overview "Needs you", in this order: a live or joinable vote, reviews waiting (with progress),
 * applicants needing interview times, voting complete, offers awaiting a response.
 */
export function recruitingNeeds(data: Overview, hrefs: RailHrefs): NeedsCard[] {
  const { operations: op, membership: m, club } = data
  const cards: NeedsCard[] = []
  const live = op.votes.filter(v => v.state === "OPEN" || !v.participants.length && !!v.joinOpenedAt && !voteComplete(v) && !hasPermission(m, "decisions.manage"))
  if (live[0]) cards.push({ id: "vote-live", priority: 1, title: live[0].state === "OPEN" ? live.length === 1 ? "Voting is open" : `${live.length} voting sessions are open` : "You can join a voting session", detail: live.map(v => `${v.round.name} · ${votingStateLabel(v.state)}`).join(" · "), action: { kind: "link", href: voteHref(club.id, m, live[0]), label: live[0].state === "OPEN" ? TERMS.openVoting : "Join session" } })
  const pending = op.rounds.reduce((n, r) => n + r.pending, 0), eligible = op.rounds.reduce((n, r) => n + r.eligible, 0)
  if (hasPermission(m, "applications.review") && pending > 0 && hrefs.applicants) cards.push({ id: "reviews", priority: 2, title: `${plural(pending, "application")} to review`, detail: op.rounds.filter(r => r.pending > 0).map(r => `${r.name} · ${r.pending} left`).join(" · "), progress: { done: eligible - pending, total: eligible }, action: { kind: "link", href: quickReviewHref(hrefs.applicants, op.rounds), label: "Open applicants" } })
  const unscheduled = op.rounds.filter(r => r.needsBooking > 0), needsTime = unscheduled.reduce((n, r) => n + r.needsBooking, 0)
  if (hasPermission(m, "interviews.manage") && needsTime > 0 && hrefs.interviews) cards.push({ id: "interviews", priority: 3, title: `${plural(needsTime, "applicant")} ${needsTime === 1 ? "needs" : "need"} an interview time`, detail: unscheduled.map(r => r.name).join(" · "), action: { kind: "link", href: `${hrefs.interviews}&interviewTab=schedule&roundId=${unscheduled[0]!.id}`, label: TERMS.scheduleInterviews } })
  const done = op.votes.filter(voteComplete)
  if (done[0]) cards.push({ id: "vote-complete", priority: 4, title: "Voting complete", detail: `${done.map(v => v.round.name).join(" · ")} · Send decisions when you are ready`, action: { kind: "link", href: voteHref(club.id, m, done[0]), label: TERMS.openSession } })
  if (op.offers[0]) cards.push({ id: "offers", priority: 5, title: `${plural(op.offers.length, "offer")} awaiting a response`, detail: `Next expires ${new Date(op.offers[0].expiresAt).toLocaleDateString([], { month: "short", day: "numeric" })}`, action: { kind: "applicant", label: "View offer", applicationId: op.offers[0].applicationId } })
  return cards.sort((a, b) => a.priority - b.priority).slice(0, 4)
}

export type PipelineStage = { id: "applied" | "review" | "interviews" | "offers"; label: string; count: number; tone: "navy" | "info" | "interview" }
/** Stages from application status counts. A count is null when this member may not read applicants. */
export function pipeline(recruitment: Overview["recruitment"]): { stages: PipelineStage[]; total: number; declined: number; waitlisted: number } | null {
  if (!recruitment) return null
  const count = (...statuses: string[]) => recruitment.filter(r => statuses.includes(r.status)).reduce((n, r) => n + r.count, 0)
  const total = recruitment.filter(r => r.status !== "DRAFTING").reduce((n, r) => n + r.count, 0)
  return {
    total, declined: count("REJECTED"), waitlisted: count("WAITLISTED"),
    stages: [
      { id: "applied", label: "Applied", count: total, tone: "navy" },
      { id: "review", label: "In review", count: count("SUBMITTED", "IN_REVIEW"), tone: "info" },
      { id: "interviews", label: "Interviews", count: count("INTERVIEWING"), tone: "interview" },
      { id: "offers", label: "Offers", count: count("ACCEPTED"), tone: "navy" },
    ],
  }
}

/** Never a name or initials where the booking's round is anonymized. */
export function interviewPerson(booking: Booking, rounds: Overview["operations"]["rounds"]) {
  const anonymous = rounds.find(r => r.id === booking.roundId)?.anonymous === true
  const label = anonymous ? anonymousApplicantLabel(booking.applicationId) : booking.candidate
  const initials = anonymous || /^Applicant [0-9A-F]+$/.test(label) ? "" : label.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join("")
  return { label, initials, anonymous }
}

export type WeekItem = { id: string; kind: "meeting" | "task"; at: Date; title: string; detail: string; meetingId?: string; assignmentId?: string; taskId?: string }
/** Club home "This week": meetings and task due dates in the next seven days, soonest first. No recruiting dates. */
export function thisWeek(data: Overview): WeekItem[] {
  const op = data.operations, now = +new Date(op.asOf)
  const soon = (at: Date | string | null | undefined) => !!at && +new Date(at) >= now && +new Date(at) <= now + 7 * DAY
  const mine = new Set(data.work.map(w => w.task.id))
  const items: WeekItem[] = [
    ...op.meetings.filter(m => soon(m.date)).map(m => ({ id: `meeting:${m.id}`, kind: "meeting" as const, at: new Date(m.date), title: m.title, detail: m.location || "Meeting", meetingId: m.id })),
    ...data.work.filter(w => soon(w.task.dueAt)).map(w => ({ id: `task:${w.id}`, kind: "task" as const, at: new Date(w.task.dueAt!), title: w.task.title, detail: "Your task due", assignmentId: w.id, taskId: w.task.id })),
    ...op.teamTasks.filter(t => !mine.has(t.id) && soon(t.dueAt)).map(t => ({ id: `team:${t.id}`, kind: "task" as const, at: new Date(t.dueAt), title: t.title, detail: `Team task due · ${t.outstanding} open` })),
  ]
  return items.sort((a, b) => +a.at - +b.at || (a.id < b.id ? -1 : 1))
}

/** Recruiting Overview "Key dates": the application deadline and scheduled decisions and messages. */
export function keyDates(op: Overview["operations"]) {
  const now = +new Date(op.asOf), deadline = op.intake?.applicationDeadline
  return [
    ...(deadline && +new Date(deadline) > now ? [{ id: "intake", title: op.intake?.applicationOpen ? "Applications close" : "Application deadline", at: new Date(deadline), kind: "deadline" }] : []),
    ...op.scheduled.map(s => ({ id: s.id, title: s.kind === "DECISION" ? "Decisions scheduled to send" : "Communication scheduled", at: new Date(s.scheduledAt), kind: "deadline" })),
  ].sort((a, b) => +a.at - +b.at)
}
