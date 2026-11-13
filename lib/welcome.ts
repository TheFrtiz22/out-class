import type { ClubEvent, Notification } from "@/lib/data"
import type { HomeApplicationSource } from "@/lib/student-home"
import { eventStart } from "@/lib/calendar"
import { pluralize } from "@/lib/copy/terms"
import { applicationIntakeClosed } from "@/lib/recruitment-presentation"
import { hasPermission, isActiveMembership, type ClubAccess } from "@/lib/permissions"
import { interviewCapabilities } from "@/lib/interview-access"
import type { getClubWorkspaceOverview } from "@/lib/workspace-api"

type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
type Candidate = { id: string; priority: number; at: number; message: string }
export type WelcomeContext =
  | { mode: "personal"; applications: HomeApplicationSource[] | null; events: ClubEvent[]; memberClubIds: string[]; notifications?: Pick<Notification, "clubId" | "taskActivity">[] }
  | { mode: "club"; clubId: string; membership: ClubAccess & { id: string }; data: Overview | null }

const HOUR = 3_600_000
const DAY = 24 * HOUR
const instant = (value: Date | string | null | undefined) => value ? +new Date(value) : NaN
const count = (value: number | null | undefined): value is number => Number.isSafeInteger(value) && value! > 0
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
function tomorrow(date: Date, now: Date) {
  const next = new Date(now)
  next.setDate(next.getDate() + 1)
  return sameDay(date, next)
}
const clockTime = (at: number) => new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

/** Called only with device-local time after hydration. Never assumes the school's timezone. */
export function welcomeGreeting(now: Date | null, firstName?: string | null) {
  const name = firstName?.trim()
  if (!now || !Number.isFinite(+now)) return name ? `Welcome, ${name}.` : "Welcome to OutClass."
  const hour = now.getHours()
  if (hour < 5 || hour >= 21) return name ? `Still up, ${name}?` : "Still up?"
  const salutation = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  return `${salutation}${name ? `, ${name}` : ""}.`
}

/** One deterministic choice: priority, earliest instant, then stable record ID. */
export function welcomeSubtitle(context: WelcomeContext, now: Date | null) {
  const fallback = context.mode === "personal" ? "Explore what's new in OutClass." : "Nothing due this week."
  if (!now || !Number.isFinite(+now)) return fallback
  const candidates: Candidate[] = []
  const add = (id: string, priority: number, at: number, message: string) => candidates.push({ id, priority, at, message })
  const deadline = (id: string, at: number, label: "application" | "task" | "recruiting") => {
    if (!Number.isFinite(at)) return
    const urgent = at <= +now + DAY
    const overdue = at < +now
    const message = label === "task"
      ? overdue ? "You have an overdue task." : tomorrow(new Date(at), now) ? "You have a task due tomorrow." : "You have a task due today."
      : label === "recruiting"
        ? overdue ? "Your application deadline has passed. Review your application settings." : "Your application deadline is approaching."
        : overdue ? "An application deadline has passed. Check your draft." : tomorrow(new Date(at), now) ? "You have an application deadline tomorrow." : "You have an application deadline today."
    if (urgent) add(id, 1, at, message)
  }
  const schedule = (id: string, at: number, kind: "interview" | "meeting" | "club event", allDay = false) => {
    if (!Number.isFinite(at) || at < +now && !(allDay && sameDay(new Date(at), now))) return
    const date = new Date(at)
    const priority = !allDay && at <= +now + 3 * HOUR ? 2 : sameDay(date, now) ? 4 : 5
    const when = allDay ? sameDay(date, now) ? "today" : tomorrow(date, now) ? "tomorrow" : `on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : sameDay(date, now) ? `at ${clockTime(at)}` : tomorrow(date, now) ? `tomorrow at ${clockTime(at)}` : `on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${clockTime(at)}`
    add(id, priority, at, `Your next ${kind} ${allDay ? "is" : "starts"} ${when}.`)
  }

  if (context.mode === "personal") {
    // null means not loaded; an empty list is a valid, loaded result.
    if (context.applications === null) return fallback
    const tasks = new Map((context.notifications ?? []).flatMap(n => n.clubId && context.memberClubIds.includes(n.clubId) && n.taskActivity?.needsSubmission ? [[n.taskActivity.assignmentId, n.taskActivity] as const] : []))
    for (const [id, task] of tasks) deadline(`task:${id}`, instant(task.dueAt), "task")
    if (tasks.size) add("work", 3, Math.min(...[...tasks.values()].map(t => instant(t.dueAt)).filter(Number.isFinite), Infinity), "You have tasks ready to work on.")
    for (const app of context.applications) {
      if (app.status === "DRAFTING" && app.club.applicationOpen !== false) deadline(`deadline:${app.id}`, instant(app.club.applicationDeadline), "application")
    }
    for (const event of context.events) {
      if (event.response === "declined" || event.type === "Deadline") continue
      const confirmed = event.response === "going" || event.response === "confirmed"
      const memberMeeting = !!event.clubId && context.memberClubIds.includes(event.clubId) && event.type === "Other"
      if (!confirmed && !memberMeeting) continue
      schedule(event.id, +eventStart(event), event.type === "Interview" ? "interview" : memberMeeting ? "meeting" : "club event", event.allDay)
    }
    // A draft for a club that stopped taking applications cannot be finished or progress, so it is not counted.
    const live = context.applications.filter(a => a.status !== "DRAFTING" || !applicationIntakeClosed(a.club, +now))
    const drafts = live.filter(a => a.status === "DRAFTING").length
    if (drafts) add("drafts", 3, Infinity, `You have ${pluralize(drafts, "application")} to finish.`)
    const active = live.filter(a => ["DRAFTING", "SUBMITTED", "IN_REVIEW", "INTERVIEWING"].includes(a.status)).length
    if (active) add("applications", 5, Infinity, `You have ${active} ${active === 1 ? "application" : "applications"} in progress.`)
  } else {
    const { data, membership, clubId } = context
    // The parent fences account/grant epochs; this also refuses a mismatched club or member DTO.
    if (!isActiveMembership(membership) || !data || data.club.id !== clubId || data.membership.id !== membership.id || !isActiveMembership(data.membership)) return fallback
    const permitted = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(membership, permission) && hasPermission(data.membership, permission)
    const op = data.operations
    for (const item of data.work) deadline(`task:${item.id}`, instant(item.task.dueAt), "task")
    if (count(op.tasks.overdue)) add("overdue", 1, -Infinity, `You have ${op.tasks.overdue} overdue ${op.tasks.overdue === 1 ? "task" : "tasks"}.`)
    if (permitted("tasks.manage") && op.team && count(op.team.overdue)) add("team-overdue", 1, -Infinity, `${op.team.overdue} team ${op.team.overdue === 1 ? "task is" : "tasks are"} overdue.`)
    if ((permitted("applications.review") || permitted("applicants.identify")) && op.intake?.applicationOpen) deadline("intake", instant(op.intake.applicationDeadline), "recruiting")
    const canInterview = permitted("applicants.identify") && (permitted("interviews.manage") || interviewCapabilities(membership).participate && interviewCapabilities(data.membership).participate)
    if (canInterview) for (const booking of op.bookings) schedule(`interview:${booking.id}`, instant(booking.slot.startTime), "interview")
    for (const meeting of op.meetings) schedule(`meeting:${meeting.id}`, instant(meeting.date), "meeting")
    const total = (key: "pending" | "needsBooking") => op.rounds.every(r => Number.isSafeInteger(r[key]) && r[key] >= 0) ? op.rounds.reduce((n, r) => n + r[key], 0) : 0
    const reviews = total("pending"), scheduling = total("needsBooking")
    if (permitted("applications.review") && count(reviews)) add("reviews", 3, Infinity, `${reviews} ${reviews === 1 ? "application is" : "applications are"} ready for your review.`)
    if (permitted("interviews.manage") && count(scheduling)) add("scheduling", 3, Infinity, `${scheduling} ${scheduling === 1 ? "interview still needs" : "interviews still need"} to be scheduled.`)
    if (permitted("tasks.manage") && count(op.tasks.awaitingReview)) add("submissions", 3, Math.min(...op.reviewWork.map(r => instant(r.submittedAt)).filter(Number.isFinite), Infinity), `${op.tasks.awaitingReview} ${op.tasks.awaitingReview === 1 ? "submission is" : "submissions are"} ready for review.`)
    if (data.work.length) add("work", 3, Math.min(...data.work.map(w => instant(w.task.dueAt)).filter(Number.isFinite), Infinity), "You have tasks ready to work on.")
    for (const update of op.announcements) {
      const at = instant(update.publishedAt)
      if (Number.isFinite(at) && at <= +now && sameDay(new Date(at), now)) add(`update:${update.id}`, 4, at, "There's a new update in your club today.")
    }
  }
  return candidates.sort((a, b) => a.priority - b.priority || (a.at === b.at ? 0 : a.at < b.at ? -1 : 1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0]?.message ?? fallback
}

/** Club mode only: the time left until the application deadline while recruiting is open.
 * Same access fences as welcomeSubtitle; device-local time after hydration. */
export function welcomeDeadline(context: WelcomeContext, now: Date | null) {
  if (context.mode !== "club" || !now || !Number.isFinite(+now)) return null
  const { data, membership, clubId } = context
  if (!isActiveMembership(membership) || !data || data.club.id !== clubId || data.membership.id !== membership.id || !isActiveMembership(data.membership)) return null
  const permitted = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(membership, permission) && hasPermission(data.membership, permission)
  const intake = data.operations.intake
  if (!(permitted("applications.review") || permitted("applicants.identify")) || !intake?.applicationOpen || !intake.applicationDeadline) return null
  const left = instant(intake.applicationDeadline) - +now
  if (!(left > 0)) return null
  const hours = Math.floor(left / HOUR), days = Math.floor(left / DAY)
  return `Applications close in ${days >= 2 ? `${days} days` : hours >= 2 ? `${hours} hours` : hours === 1 ? "1 hour" : "less than an hour"}.`
}
