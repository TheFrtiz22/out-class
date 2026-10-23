import { Prisma } from "@prisma/client"
import { prisma } from "@/utils/prisma"
import { hasPermission, type ClubAccess } from "@/lib/permissions"
import { eventIsPublished } from "@/lib/campus-events"
import { interviewCapabilities } from "@/lib/interview-access"
import { kitSchema } from "@/lib/interview-kits"
import { anonymousApplicantLabel } from "@/lib/anonymous-review"

/** No shared cache: this projection is private to one membership and current request. */
export async function dashboardSummary(clubId: string, member: ClubAccess & { id: string; userId: string }) {
  const now = new Date(), week = new Date(+now + 7 * 86400000)
  const read = hasPermission(member, "applications.review") || hasPermission(member, "applicants.identify")
  const identify = hasPermission(member, "applicants.identify"), review = hasPermission(member, "applications.review"), manage = hasPermission(member, "tasks.manage")
  const { eligible, unfinished } = reviewScope(clubId, member)
  const [intake, cycles, rounds, queue, meetings, announcements, taskTotals, reviewWork, bookings, votes, scheduled, teamRows, offers] = await Promise.all([
    read ? prisma.club.findUniqueOrThrow({ where: { id: clubId }, select: { applicationOpen: true, applicationDeadline: true } }) : null,
    read ? prisma.recruitmentCycle.findMany({ where: { clubId, archivedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, _count: { select: { applications: { where: { status: { not: "DRAFTING" }, ...(!identify ? { round: { anonymousReview: true } } : {}) } } } } }, take: 10 }) : [],
    read ? prisma.$queryRaw<{ id: string; name: string; type: string; anonymous: boolean; count: number; eligible: number; pending: number; needsBooking: number; bookingPublishedAt: Date | null; bookingPaused: boolean }[]>(Prisma.sql`
      SELECT r.id,r.name,r.type,r."anonymousReview" AS anonymous,r."bookingPublishedAt",r."bookingPaused",
        COUNT(a.id)::int AS count,
        COUNT(a.id) FILTER (WHERE ${eligible})::int AS eligible,
        COUNT(a.id) FILTER (WHERE ${eligible} AND ${unfinished})::int AS pending,
        COUNT(a.id) FILTER (WHERE r.type IN ('INTERVIEW','GROUP_INTERVIEW') AND NOT EXISTS (SELECT 1 FROM "InterviewBooking" b WHERE b."applicationId"=a.id AND b."roundId"=r.id))::int AS "needsBooking"
      FROM "PipelineRound" r LEFT JOIN "Application" a ON a."roundId"=r.id AND a."clubId"=${clubId} AND r."clubId"=${clubId} AND a.status NOT IN ('DRAFTING','ACCEPTED','REJECTED','WAITLISTED')
      WHERE r."clubId"=${clubId} AND r."archivedAt" IS NULL AND (${identify} OR r."anonymousReview")
      GROUP BY r.id ORDER BY r."order" ASC`) : [],
    read ? dashboardReviewQueue(clubId, member) : [],
    prisma.meeting.findMany({ where: { clubId, date: { gte: now, lte: week } }, select: { id: true, title: true, date: true, location: true, agenda: true, audience: true, revision: true, isPublic: true, publication: { select: { status: true, approvedRevision: true, rsvpEnabled: true } } }, orderBy: { date: "asc" }, take: 4 }),
    prisma.clubAnnouncement.findMany({ where: { clubId, publishedAt: { lte: now }, notifications: { some: { userId: member.userId } } }, select: { id: true, title: true, body: true, publishedAt: true }, orderBy: { publishedAt: "desc" }, take: 3 }),
    Promise.all([
      prisma.taskAssignment.count({ where: { memberId: member.id, task: { clubId, kind: "TASK", status: { not: "DRAFT" } } } }),
      prisma.taskAssignment.count({ where: { memberId: member.id, reviewedAt: { not: null }, task: { clubId, kind: "TASK", status: { not: "DRAFT" } } } }),
      prisma.taskAssignment.count({ where: { memberId: member.id, reviewedAt: null, OR: [{ submittedAt: null }, { revisionRequestedAt: { not: null } }], task: { clubId, kind: "TASK", status: { notIn: ["DRAFT", "DONE"] }, dueAt: { lt: now } } } }),
      manage ? prisma.taskAssignment.count({ where: { submittedAt: { not: null }, reviewedAt: null, revisionRequestedAt: null, task: { clubId, kind: "TASK", status: { not: "DRAFT" } } } }) : null,
    ]),
    manage ? prisma.taskAssignment.findMany({ where: { submittedAt: { not: null }, reviewedAt: null, revisionRequestedAt: null, task: { clubId, kind: "TASK", status: { not: "DRAFT" } } }, select: { id: true, submittedAt: true, task: { select: { id: true, title: true, dueAt: true } } }, orderBy: [{ submittedAt: "asc" }, { id: "asc" }], take: 4 }) : [],
    identify && (hasPermission(member, "interviews.manage") || interviewCapabilities(member).participate) ? prisma.interviewBooking.findMany({ where: { ...(!hasPermission(member, "interviews.manage") ? { panelAssignments: { some: { memberId: member.id, revokedAt: null } } } : {}), slot: { clubId, startTime: { gte: now, lte: week }, room: { isOpen: true } }, application: { clubId, status: { not: "DRAFTING" }, round: { anonymousReview: false } }, round: { anonymousReview: false, archivedAt: null } }, select: { id: true, applicationId: true, roundId: true, application: { select: { student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } }, slot: { select: { id: true, startTime: true, endTime: true, location: true, roomId: true } }, round: { select: { name: true, interviewKit: true } } }, orderBy: { slot: { startTime: "asc" } }, take: 6 }) : [],
    review && (hasPermission(member, "decisions.vote") || hasPermission(member, "decisions.view") || hasPermission(member, "decisions.manage")) ? prisma.votingSession.findMany({ where: { clubId, publishedAt: null, state: { in: ["DRAFT", "OPEN", "PAUSED", "COMPLETED"] }, ...(hasPermission(member, "decisions.view") || hasPermission(member, "decisions.manage") ? {} : { OR: [{ participants: { some: { memberId: member.id } } }, { joinOpenedAt: { not: null }, state: { in: ["DRAFT", "OPEN", "PAUSED"] }, ...(!identify ? { round: { anonymousReview: true } } : {}) }] }) }, select: { id: true, state: true, joinOpenedAt: true, participants: { where: { memberId: member.id }, select: { memberId: true } }, publishedAt: true, round: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 4 }) : [],
    identify && (hasPermission(member, "decisions.manage") || hasPermission(member, "decisions.publish")) ? prisma.scheduledCommunication.findMany({ where: { clubId, scheduledAt: { gte: now, lte: week }, status: "SCHEDULED" }, select: { id: true, scheduledAt: true, kind: true }, orderBy: { scheduledAt: "asc" }, take: 5 }) : [],
    manage ? prisma.$queryRaw<{ assigned: number; reviewed: number; overdue: number; recentSubmissions: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS assigned, COUNT(*) FILTER (WHERE a."reviewedAt" IS NOT NULL)::int AS reviewed,
      COUNT(*) FILTER (WHERE t.status <> 'DONE' AND a."reviewedAt" IS NULL AND (a."submittedAt" IS NULL OR a."revisionRequestedAt" IS NOT NULL) AND t."dueAt" < ${now})::int AS overdue,
      COUNT(*) FILTER (WHERE a."submittedAt" >= ${new Date(+now - 7 * 86400000)})::int AS "recentSubmissions"
      FROM "TaskAssignment" a JOIN "ClubTask" t ON t.id=a."taskId"
      WHERE t."clubId"=${clubId} AND t.kind='TASK' AND t.status <> 'DRAFT'`) : [],
    identify && hasPermission(member, "decisions.manage") ? prisma.clubInvitation.findMany({ where: { clubId, status: "PENDING", expiresAt: { gt: now }, revokedAt: null, acceptedAt: null, declinedAt: null, expiredAt: null, application: { clubId, status: "ACCEPTED" } }, select: { id: true, applicationId: true, expiresAt: true, application: { select: { id: true, round: { select: { anonymousReview: true } }, student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: 4 }) : [],
  ])
  return { offers: offers.flatMap(o => o.application ? [{ id: o.id, applicationId: o.application.id, expiresAt: o.expiresAt, label: o.application.round.anonymousReview || !o.application.student.studentProfile ? anonymousApplicantLabel(o.application.id) : `${o.application.student.studentProfile.firstName} ${o.application.student.studentProfile.lastName}` }] : []), team: manage && teamRows.length ? teamRows[0] : null, asOf: now, intake, cycles: cycles.map(c => ({ id: c.id, name: c.name, applicants: c._count.applications })), rounds,
    queue,
    meetings: meetings.map(({ publication, revision, isPublic, ...m }) => ({ ...m, canRsvp: !!publication?.rsvpEnabled && eventIsPublished({ ...m, revision, isPublic, publication }) })), announcements, tasks: { assigned: taskTotals[0]!, completed: taskTotals[1]!, overdue: taskTotals[2]!, awaitingReview: taskTotals[3] }, reviewWork, bookings: bookings.map(({ application, round, ...b }) => ({ ...b, round: round ? { name: round.name } : null, candidate: application.student.studentProfile ? `${application.student.studentProfile.firstName} ${application.student.studentProfile.lastName}` : anonymousApplicantLabel(b.applicationId), kitQuestions: kitSchema.safeParse(round?.interviewKit).data?.length ?? 0 })), votes, scheduled }
}

function reviewScope(clubId: string, member: ClubAccess & { id: string; userId: string }) {
  const identify = hasPermission(member, "applicants.identify"), review = hasPermission(member, "applications.review")
  const visible = Prisma.sql`a."clubId"=${clubId} AND a.status <> 'DRAFTING' AND r."archivedAt" IS NULL AND (${identify} OR r."anonymousReview")`
  const eligible = Prisma.sql`a."studentId" <> ${member.userId} AND ${review} AND (r."anonymousReview" OR (${identify} AND EXISTS (SELECT 1 FROM "InterviewPanelAssignment" p WHERE p."applicationId"=a.id AND p."roundId"=a."roundId" AND p."memberId"=${member.id} AND p."revokedAt" IS NULL)))`
  const unfinished = Prisma.sql`NOT EXISTS (SELECT 1 FROM "Evaluation" e WHERE e."applicationId"=a.id AND e."roundId"=a."roundId" AND e."interviewerId"=${member.id} AND e."submittedAt" IS NOT NULL)`
  return { visible, eligible, unfinished }
}
export async function dashboardReviewQueue(clubId: string, member: ClubAccess & { id: string; userId: string }, roundId?: string) {
  const identify = hasPermission(member, "applicants.identify")
  const { visible, eligible, unfinished } = reviewScope(clubId, member)
  const rows = await prisma.$queryRaw<{ id: string; roundId: string; round: string; anonymous: boolean; firstName: string | null; lastName: string | null }[]>(Prisma.sql`
      SELECT a.id,a."roundId",r.name AS round,r."anonymousReview" AS anonymous,
      CASE WHEN ${identify} AND NOT r."anonymousReview" THEN s."firstName" ELSE NULL END AS "firstName",
      CASE WHEN ${identify} AND NOT r."anonymousReview" THEN s."lastName" ELSE NULL END AS "lastName"
      FROM "Application" a JOIN "PipelineRound" r ON r.id=a."roundId"
      LEFT JOIN "StudentProfile" s ON s."userId"=a."studentId"
      WHERE ${visible} AND (${roundId ?? null}::text IS NULL OR a."roundId"=${roundId ?? null}) AND ${eligible} AND ${unfinished} AND a.status IN ('SUBMITTED','IN_REVIEW','INTERVIEWING')
      ORDER BY a."submittedAt" ASC NULLS LAST,a.id ASC LIMIT 12`)
  return rows.map(({ firstName, lastName, ...row }) => ({ ...row, label: firstName ? `${firstName} ${lastName ?? ""}`.trim() : anonymousApplicantLabel(row.id) }))
}
