import type { ClubEvent, Notification, TrackedApplication } from "@/lib/data"
import { eventStart } from "@/lib/calendar"

export type HomeApplicationSource = {
  id: string
  clubId: string
  status: string
  submittedAt?: Date | string | null
  club: { name: string; color?: string | null; logoUrl?: string | null }
  answers?: { response: string }[]
}
export type HomeApplication = {
  id: string
  clubId: string
  name: string
  color: string
  logoUrl?: string | null
  status: string
  draft: boolean
  closed: boolean
  deadline?: ClubEvent
  responsesSaved?: number
}
const statusLabels: Record<string, string> = {
  DRAFTING: "Drafting",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In Review",
  INTERVIEWING: "Interviewing",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WAITLISTED: "Waitlisted",
  "1st Round Interview": "Interviewing",
  "2nd Round Interview": "Interviewing",
}
export function homeApplications(
  real: HomeApplicationSource[] | null,
  local: TrackedApplication[],
  events: ClubEvent[],
): HomeApplication[] {
  const rows =
    real !== null
      ? real.map((app) => ({
          id: app.id,
          clubId: app.clubId,
          name: app.club.name,
          color: app.club.color || "#142d4e",
          logoUrl: app.club.logoUrl,
          status: statusLabels[app.status] || app.status,
          responsesSaved: app.answers?.filter((answer) => answer.response.trim()).length,
        }))
      : local.map((app) => ({
          id: app.id,
          clubId: app.clubId,
          name: app.clubName,
          color: app.color,
          logoUrl: app.logoUrl,
          status: statusLabels[app.status] || app.status,
          responsesSaved: undefined,
        }))
  return rows
    .map((app) => ({
      ...app,
      draft: app.status === "Drafting",
      closed: ["Accepted", "Rejected"].includes(app.status),
      deadline:
        app.status === "Drafting"
          ? events
              .filter(
                (event) =>
                  event.clubId === app.clubId &&
                  event.type === "Deadline" &&
                  event.response !== "declined" &&
                  Number.isFinite(eventStart(event).getTime()),
              )
              .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())[0]
          : undefined,
    }))
    .sort(
      (a, b) =>
        Number(a.closed) - Number(b.closed) ||
        Number(b.draft) - Number(a.draft) ||
        (a.deadline ? eventStart(a.deadline).getTime() : Infinity) -
          (b.deadline ? eventStart(b.deadline).getTime() : Infinity) ||
        a.name.localeCompare(b.name),
    )
}
export function upcomingAgenda(events: ClubEvent[], now: Date) {
  return events
    .filter(
      (event) =>
        event.type !== "Deadline" &&
        event.response !== "declined" &&
        eventStart(event).getTime() >= now.getTime(),
    )
    .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
}
export function relevantUpdates(notifications: Notification[]) {
  return [...notifications]
    .sort(
      (a, b) =>
        Number(a.read) - Number(b.read) ||
        Number(b.urgent) - Number(a.urgent) ||
        (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0),
    )
    .slice(0, 3)
}
export type NextAction =
  | { kind: "application"; application: HomeApplication }
  | { kind: "event"; event: ClubEvent }
  | { kind: "discover" }
export function nextHomeAction(
  apps: HomeApplication[],
  agenda: ClubEvent[],
  now: Date,
): NextAction {
  const draft = apps.find((app) => app.draft)
  const deadline = apps
    .filter((app) => app.draft && app.deadline && eventStart(app.deadline) >= now)
    .sort((a, b) => eventStart(a.deadline!).getTime() - eventStart(b.deadline!).getTime())[0]
  const event = agenda[0]
  const urgentUntil = now.getTime() + 48 * 60 * 60 * 1000
  const deadlineTime = deadline?.deadline ? eventStart(deadline.deadline).getTime() : Infinity
  const eventTime = event ? eventStart(event).getTime() : Infinity
  if (Math.min(deadlineTime, eventTime) <= urgentUntil)
    return deadlineTime <= eventTime
      ? { kind: "application", application: deadline! }
      : { kind: "event", event }
  if (draft) return { kind: "application", application: draft }
  if (event) return { kind: "event", event }
  return { kind: "discover" }
}
