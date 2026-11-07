import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { hasPermission, type ClubAccess } from "@/lib/permissions"
import { leaderRailSections, railItems } from "@/lib/navigation"
import { anonymousApplicantLabel } from "@/lib/anonymous-review"
import { TERMS } from "@/lib/copy/terms"

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
    meetings: href("meetings"), tasks: href("tasks"), announcements: href("announcements"), members: href("members"),
  }
}
export type RailHrefs = ReturnType<typeof railHrefs>

export type NeedsAction =
  | { kind: "link"; href: string; label: string }
  | { kind: "task"; label: string; taskId: string; assignmentId: string; title: string; review?: boolean }
export type NeedsCard = { id: string; priority: number; title: string; detail: string; progress?: { done: number; total: number }; action: NeedsAction }

export function isOverdue(due: Date | string | null | undefined, now: number) {
  return !!due && +new Date(due) < now
}

/** 2–4 cards, most urgent first. Each card needs the permission its data and destination need. */
export function needsYou(data: Overview, hrefs: RailHrefs): NeedsCard[] {
  const { operations: op, membership: m } = data
  const now = +new Date(op.asOf)
  const cards: NeedsCard[] = []
  const live = op.votes.filter(v => v.state === "OPEN")
  if (live.length && hrefs.decisions) cards.push({ id: "vote-live", priority: 1, title: live.length === 1 ? "Voting is live" : `${live.length} voting sessions are live`, detail: live.map(v => v.round.name).join(" · "), action: { kind: "link", href: hrefs.decisions, label: TERMS.openVoting } })
  if (op.tasks.overdue > 0) {
    const first = data.work.find(w => isOverdue(w.task.dueAt, now))
    if (first || hrefs.tasks) cards.push({ id: "overdue", priority: 2, title: `${plural(op.tasks.overdue, "task")} overdue`, detail: first ? first.task.title : "Open your tasks to catch up.", action: first ? { kind: "task", label: "Open task", taskId: first.task.id, assignmentId: first.id, title: first.task.title } : { kind: "link", href: `${hrefs.tasks}&taskView=mine`, label: "Open tasks" } })
  }
  const unscheduled = op.rounds.filter(r => r.needsBooking > 0)
  const needsTime = unscheduled.reduce((n, r) => n + r.needsBooking, 0)
  if (hasPermission(m, "interviews.manage") && needsTime > 0 && hrefs.interviews) cards.push({ id: "interviews", priority: 3, title: `${plural(needsTime, "interview")} ${needsTime === 1 ? "needs" : "need"} a time`, detail: unscheduled.map(r => r.name).join(" · "), action: { kind: "link", href: `${hrefs.interviews}&interviewTab=schedule`, label: TERMS.scheduleInterviews } })
  const round = op.rounds.find(r => r.pending > 0)
  if (hasPermission(m, "applications.review") && round && hrefs.applicants) cards.push({ id: "reviews", priority: 4, title: `${plural(round.pending, "application")} to review`, detail: `${round.name} · ${round.pending} left`, progress: { done: round.eligible - round.pending, total: round.eligible }, action: { kind: "link", href: hrefs.applicants, label: "Open applicants" } })
  const submission = op.reviewWork[0]
  if (hasPermission(m, "tasks.manage") && (op.tasks.awaitingReview ?? 0) > 0 && submission) cards.push({ id: "submissions", priority: 5, title: `${plural(op.tasks.awaitingReview!, "submission")} waiting for feedback`, detail: submission.task.title, action: { kind: "task", label: "Give feedback", taskId: submission.task.id, assignmentId: submission.id, title: submission.task.title, review: true } })
  const upcoming = op.votes.filter(v => v.state === "DRAFT" || v.state === "PAUSED")
  if (!live.length && upcoming.length && hrefs.decisions) cards.push({ id: "vote-upcoming", priority: 6, title: upcoming[0].state === "PAUSED" ? "Voting is paused" : "Voting session ready", detail: upcoming.map(v => v.round.name).join(" · "), action: { kind: "link", href: hrefs.decisions, label: TERMS.openVoting } })
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

export type WeekItem = { id: string; kind: "meeting" | "interview" | "deadline"; at: Date; title: string; detail: string; meetingId?: string; bookingId?: string }
/** Meetings, interviews and dated deadlines in the next seven days, soonest first. */
export function thisWeek(data: Overview): WeekItem[] {
  const op = data.operations, now = +new Date(op.asOf)
  const soon = (at: Date | string | null | undefined) => !!at && +new Date(at) >= now && +new Date(at) <= now + 7 * DAY
  const items: WeekItem[] = [
    ...op.meetings.map(m => ({ id: `meeting:${m.id}`, kind: "meeting" as const, at: new Date(m.date), title: m.title, detail: m.location || "Meeting", meetingId: m.id })),
    ...op.bookings.map(b => { const person = interviewPerson(b, op.rounds); return { id: `interview:${b.id}`, kind: "interview" as const, at: new Date(b.slot.startTime), title: `Interview · ${person.label}`, detail: [b.round?.name, b.slot.location].filter(Boolean).join(" · "), bookingId: b.id } }),
    ...(op.intake?.applicationOpen && soon(op.intake.applicationDeadline) ? [{ id: "deadline:intake", kind: "deadline" as const, at: new Date(op.intake.applicationDeadline!), title: "Applications close", detail: "Application deadline" }] : []),
    ...op.scheduled.filter(s => soon(s.scheduledAt)).map(s => ({ id: `deadline:${s.id}`, kind: "deadline" as const, at: new Date(s.scheduledAt), title: s.kind === "DECISION" ? "Decisions publish" : "Scheduled message", detail: "Scheduled" })),
  ]
  return items.sort((a, b) => +a.at - +b.at || (a.id < b.id ? -1 : 1))
}
