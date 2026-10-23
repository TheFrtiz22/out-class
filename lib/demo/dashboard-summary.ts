import { demoStore } from "./store"
import { demoBookingSettings } from "./interview-booking"
import { hasPermission } from "@/lib/permissions"
import { interviewCapabilities } from "@/lib/interview-access"
import { anonymousApplicantLabel } from "@/lib/anonymous-review"
import type { dashboardSummary } from "@/utils/dashboard-summary"
type Operations = Awaited<ReturnType<typeof dashboardSummary>>

/** Same DTO as the live summary, derived exclusively from the isolated saved demo graph. */
export function demoDashboardSummary(clubId: string, memberId: string, roundId?: string): Operations {
  const s = demoStore.get(), member = s.memberships.find(m => m.id === memberId && m.clubId === clubId), club = s.clubs.find(c => c.id === clubId)
  if (!member || !club || member.status !== "ACTIVE") throw Error("Club workspace access unavailable.")
  const now = new Date(), week = +now + 7 * 86400000
  const identify = hasPermission(member, "applicants.identify"), review = hasPermission(member, "applications.review"), read = identify || review, manage = hasPermission(member, "tasks.manage")
  const apps = s.applications.filter(a => a.clubId === clubId && a.status !== "DRAFTING" && (identify || club.rounds.find(r => r.id === a.roundId)?.anonymousReview))
  const active = apps.filter(a => !["ACCEPTED", "REJECTED", "WAITLISTED"].includes(a.status))
  const eligible = active.filter(a => a.studentId !== member.userId && review && (club.rounds.find(r => r.id === a.roundId)?.anonymousReview || identify && s.interviewFoundation.assignments.some(g => g.applicationId === a.id && g.roundId === a.roundId && g.memberId === member.id && !g.revokedAt)))
  const pending = eligible.filter(a => !a.evaluations.some(e => e.roundId === a.roundId && e.interviewerId === member.id && e.submittedAt))
  const label = (applicationId: string) => {
    const a = apps.find(a => a.id === applicationId), p = s.students.find(u => u.id === a?.studentId)?.profile
    return !identify || !a || club.rounds.find(r => r.id === a.roundId)?.anonymousReview || !p ? anonymousApplicantLabel(applicationId) : `${p.firstName} ${p.lastName}`
  }
  const tasks = s.tasks.filter(t => t.clubId === clubId && t.kind === "TASK" && t.status !== "DRAFT")
  const all = tasks.flatMap(t => t.assignments.map(a => ({ t, a }))), personal = all.filter(({ a }) => a.memberId === member.id)
  const overdue = ({ t, a }: typeof all[number]) => t.status !== "DONE" && !a.reviewedAt && (!a.submittedAt || a.revisionRequestedAt) && t.dueAt && +t.dueAt < +now
  const reviewWork = all.filter(({ a }) => a.submittedAt && !a.reviewedAt && !a.revisionRequestedAt)
  const bookings: Operations["bookings"] = identify ? s.roomBookings.flatMap(b => {
    const room = s.interviewRooms.find(r => r.id === b.roomId && r.clubId === clubId && r.isOpen), round = club.rounds.find(r => r.id === b.roundId), a = apps.find(a => a.id === b.applicationId)
    if (!room || !round || !a || round.anonymousReview || club.rounds.find(r => r.id === a.roundId)?.anonymousReview || +new Date(b.startTime) < +now || +new Date(b.startTime) > week) return []
    if (!hasPermission(member, "interviews.manage") && !(interviewCapabilities(member).participate && s.interviewFoundation.assignments.some(g => g.applicationId === a.id && g.roundId === round.id && g.memberId === member.id && !g.revokedAt))) return []
    return [{ id: b.id, applicationId: a.id, roundId: round.id, candidate: label(a.id), kitQuestions: round.interviewKit.length, round: { name: round.name }, slot: { id: b.slotId, roomId: room.id, startTime: new Date(b.startTime), endTime: new Date(b.endTime), location: b.location } }]
  }).sort((a, b) => +a.slot.startTime - +b.slot.startTime).slice(0, 6) : []
  const leadership = hasPermission(member, "decisions.manage") || hasPermission(member, "decisions.view")
  return {
    asOf: now, intake: read ? { applicationOpen: club.claimed, applicationDeadline: club.deadline } : null, cycles: [],
    rounds: read ? club.rounds.filter(r => !r.archivedAt && (identify || r.anonymousReview)).map(r => {
      const booking = demoBookingSettings(r.id), pool = active.filter(a => a.roundId === r.id)
      return { id: r.id, name: r.name, type: r.type ?? "CUSTOM", anonymous: r.anonymousReview, count: pool.length, eligible: eligible.filter(a => a.roundId === r.id).length, pending: pending.filter(a => a.roundId === r.id).length, needsBooking: ["INTERVIEW", "GROUP_INTERVIEW"].includes(r.type ?? "") ? pool.filter(a => !s.roomBookings.some(b => b.applicationId === a.id && b.roundId === r.id)).length : 0, bookingPublishedAt: booking.bookingPublishedAt ? new Date(booking.bookingPublishedAt) : null, bookingPaused: booking.bookingPaused }
    }) : [],
    queue: pending.filter(a => !roundId || a.roundId === roundId).slice(0, 12).map(a => ({ id: a.id, roundId: a.roundId, round: club.rounds.find(r => r.id === a.roundId)!.name, anonymous: club.rounds.find(r => r.id === a.roundId)!.anonymousReview, label: label(a.id) })),
    meetings: s.meetings.filter(m => m.clubId === clubId && m.date >= now && +m.date <= week).sort((a, b) => +a.date - +b.date).slice(0, 4).map(m => ({ id: m.id, title: m.title, date: m.date, location: m.location, agenda: m.agenda, audience: m.audience, canRsvp: false })),
    announcements: [], tasks: { assigned: personal.length, completed: personal.filter(({ a }) => a.reviewedAt).length, overdue: personal.filter(overdue).length, awaitingReview: manage ? reviewWork.length : null },
    reviewWork: manage ? reviewWork.sort((a, b) => +a.a.submittedAt! - +b.a.submittedAt!).slice(0, 4).map(({ t, a }) => ({ id: a.id, submittedAt: a.submittedAt, task: { id: t.id, title: t.title, dueAt: t.dueAt } })) : [],
    team: manage ? { assigned: all.length, reviewed: all.filter(({ a }) => a.reviewedAt).length, overdue: all.filter(overdue).length, recentSubmissions: all.filter(({ a }) => a.submittedAt && +a.submittedAt >= +now - 7 * 86400000).length } : null,
    bookings,
    votes: review && (leadership || hasPermission(member, "decisions.vote")) ? s.votingSessions.filter(v => v.clubId === clubId && !v.publishedAt && (leadership || v.participants.some(p => p.memberId === member.id) || v.joinOpenedAt && v.state !== "COMPLETED" && (identify || club.rounds.find(r => r.id === v.roundId)?.anonymousReview))).slice(0, 4).map(v => ({ id: v.id, state: v.state, publishedAt: null, joinOpenedAt: v.joinOpenedAt ? new Date(v.joinOpenedAt) : null, participants: v.participants.filter(p => p.memberId === member.id).map(p => ({ memberId: p.memberId })), round: { name: club.rounds.find(r => r.id === v.roundId)!.name } })) : [],
    offers: identify && hasPermission(member, "decisions.manage") ? s.recruitmentOffers.filter(o => o.status === "PENDING" && o.expiresAt > now && apps.some(a => a.id === o.applicationId && a.status === "ACCEPTED")).sort((a, b) => +a.expiresAt - +b.expiresAt).slice(0, 4).map(o => ({ id: o.applicationId, applicationId: o.applicationId, expiresAt: o.expiresAt, label: label(o.applicationId) })) : [],
    scheduled: [],
  }
}
