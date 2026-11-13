import type { AppTransactionClient } from "@/utils/prisma"
import type { ClubAccess } from "@/lib/permissions"
import { activeMemberWhere } from "@/lib/permissions"
import { pipelineSummarySelect, pipelineSummaryProjection } from "@/lib/pipeline-summary"
import { applicationStatusLabel } from "@/lib/application-status"
import type { CsvCell } from "@/lib/csv"
import { membershipRoleLabel } from "@/lib/copy/terms"
import { defaultProfileFieldVisibility, restrictApplicationProfile, type ProfileFieldVisibility } from "@/lib/profile-field-visibility"

type Member = ClubAccess & { id: string; userId: string }
export type ExportTable = { header: string[]; rows: CsvCell[][] }

/** Pilot-club column set (owner decision 2026-11-10), shared by the roster and
 * the leading applicant columns, then Email and Computing ID (StudentProfile.computingId).
 * No schema field holds "exec" or a member's cycle, so both are derived
 * (see memberRoleCells and memberCycleSelect). */
const personHeader = (profileFields: ProfileFieldVisibility) =>
  ["First name", "Last name", ...(profileFields.academicYear ? ["Grad year"] : []), "Role within org", "Exec", "Recruitment cycle", "Email", "Computing ID"]

const execAccessRoles = new Set(["OWNER", "ADMIN", "RECRUITING_ADMIN"])
const execClubRoles = new Set(["PRESIDENT", "RECRUITMENT_LEAD"])
const execOffices = new Set(["PRESIDENT", "VICE_PRESIDENT", "BOARD"])
export type RoleFields = { title: string | null; isOwner: boolean; accessRole: string; role: string; interviewOffices: string[] }
export const memberRoleSelect = { title: true, isOwner: true, accessRole: true, role: true, interviewOffices: true } as const

/** Role = the member's own title, else the access-role label shown on the members screen.
 * Exec = owner, an Owner/Admin/Recruiting-lead access role, a President/Recruitment-lead
 * club role, or an explicit President/Vice-president/Board office. Interviewer and
 * Member access alone are not exec. */
export function memberRoleCells(member: RoleFields | null | undefined): CsvCell[] {
  // Not a member of this club (an applicant only): no role, and Exec is left blank.
  if (!member) return ["", ""]
  const exec = member.isOwner || execAccessRoles.has(member.accessRole) || execClubRoles.has(member.role)
    || member.interviewOffices.some(office => execOffices.has(office))
  return [member.title?.trim() || membershipRoleLabel(member), exec ? "true" : "false"]
}

/** A member's cycle: the newest accepted application to this club with a cycle, else the
 * recorded membership cohort. Nothing is inferred beyond those two stored values. */
const memberCycleSelect = (clubId: string) => ({
  where: { clubId, status: "ACCEPTED" as const, recruitmentCycleId: { not: null } },
  select: { recruitmentCycle: { select: { name: true } } },
  orderBy: [{ submittedAt: "desc" as const }, { id: "desc" as const }], take: 1,
})

/** Applicants through the same privacy projection the pipeline uses: anonymous
 * rounds stay anonymous (no name, grad year, role, exec, email or computing ID) and only scores this
 * member may already see are included. No email, GPA, test score, LinkedIn,
 * résumé, note or vote columns. */
export async function applicantExport(tx: AppTransactionClient, clubId: string, member: Member, profileFields: ProfileFieldVisibility = defaultProfileFieldVisibility(), roundId?: string | null): Promise<ExportTable> {
  const [apps, rounds] = await Promise.all([
    tx.application.findMany({
      // A round filter only narrows: the club id stays in the where clause, so another club's round returns nothing.
      where: { clubId, status: { not: "DRAFTING" }, ...(roundId ? { roundId } : {}) },
      select: { ...pipelineSummarySelect, submittedAt: true, recruitmentCycle: { select: { name: true } },
        // computingId is read here only; it is written to identified rows alone.
        student: { select: { ...pipelineSummarySelect.student.select, studentProfile: { select: { ...pipelineSummarySelect.student.select.studentProfile.select, computingId: true } } } } },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    }),
    tx.pipelineRound.findMany({ where: { clubId }, select: { id: true, name: true } }),
  ])
  const roundName = new Map(rounds.map(round => [round.id, round.name]))
  // Same rule as the pipeline (actions/crm.ts loadPipelineDetails): a member recused from an
  // applicant stops seeing that applicant's scores; the row and name stay.
  const recused = new Set((apps.length ? await tx.applicantRecusal.findMany({
    where: { clubId, memberId: member.id, liftedAt: null, applicationId: { in: apps.map(app => app.id) } }, select: { applicationId: true } }) : []).map(r => r.applicationId))
  const views = apps.map(app => {
    const view = restrictApplicationProfile(pipelineSummaryProjection(app, member), profileFields)
    return { app, view: recused.has(app.id) ? { ...view, roundScore: null } : view }
  })
  // Only identified applicants are looked up as members of this club.
  const identifiedIds = [...new Set(views.filter(({ app, view }) => view.studentId === app.studentId).map(({ app }) => app.studentId))]
  const memberships = identifiedIds.length ? await tx.clubMember.findMany({ where: { clubId, userId: { in: identifiedIds } }, select: { userId: true, ...memberRoleSelect } }) : []
  const memberOf = new Map(memberships.map(m => [m.userId, m]))
  const header = [...personHeader(profileFields), "Status", "Round", "Submitted", "Average score", "Reviews submitted"]
  const rows = views.map(({ app, view }) => {
    const identified = view.studentId === app.studentId
    const profile = view.student.studentProfile
    return [
      profile?.firstName ?? "", profile?.lastName ?? "",
      ...(profileFields.academicYear ? [identified ? app.student.studentProfile?.gradYear ?? "" : ""] : []),
      ...(identified ? memberRoleCells(memberOf.get(app.studentId)) : ["", ""]),
      app.recruitmentCycle?.name ?? "",
      identified ? view.student.email : "", identified ? app.student.studentProfile?.computingId ?? "" : "",
      applicationStatusLabel(view.status), roundName.get(view.roundId) ?? "",
      app.submittedAt ? app.submittedAt.toISOString().slice(0, 10) : "",
      view.roundScore?.average == null ? "" : Math.round(view.roundScore.average * 10) / 10,
      view.roundScore ? view.roundScore.submitted : "",
    ]
  })
  return { header, rows }
}

/** Active members only: the pilot column set has no status column. */
export async function rosterExport(tx: AppTransactionClient, clubId: string, profileFields: ProfileFieldVisibility = defaultProfileFieldVisibility()): Promise<ExportTable> {
  const members = await tx.clubMember.findMany({
    where: { clubId, ...activeMemberWhere },
    select: { ...memberRoleSelect, cohort: true,
      user: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true, gradYear: true, computingId: true } }, applications: memberCycleSelect(clubId) } } },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
  })
  return {
    // Graduation year is the class-year profile field; it follows the club setting.
    header: personHeader(profileFields),
    rows: members.map(m => [
      m.user.studentProfile?.firstName ?? "", m.user.studentProfile?.lastName ?? "",
      ...(profileFields.academicYear ? [m.user.studentProfile?.gradYear ?? ""] : []),
      ...memberRoleCells(m), m.user.applications[0]?.recruitmentCycle?.name ?? m.cohort ?? "",
      m.user.email, m.user.studentProfile?.computingId ?? "",
    ]),
  }
}

/** Same rule as the attendance and RSVP screens (`meetingAttendance`,
 * `getCampusEventRsvpDashboard`): a person with a submitted application in an
 * anonymous-review round of this club is listed without name or email. */
function anonymousApplicantWhere(clubId: string) {
  return { where: { clubId, status: { not: "DRAFTING" as const }, round: { anonymousReview: true } }, select: { id: true }, take: 1 }
}
type PersonRow = { email: string; studentProfile: { firstName: string; lastName: string } | null; applications: { id: string }[] }
function personCells(person: PersonRow): CsvCell[] {
  if (person.applications.length) return ["Anonymous applicant", "", ""]
  return [person.studentProfile?.firstName ?? "", person.studentProfile?.lastName ?? "", person.email]
}

export async function attendanceExport(tx: AppTransactionClient, clubId: string, eventId?: string | null): Promise<ExportTable> {
  const records = await tx.eventAttendance.findMany({
    where: { event: { clubId }, ...(eventId ? { eventId } : {}) },
    select: { checkedInAt: true, event: { select: { title: true, date: true } },
      student: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true } }, applications: anonymousApplicantWhere(clubId) } } },
    orderBy: [{ event: { date: "asc" } }, { checkedInAt: "asc" }],
  })
  return {
    header: ["Meeting", "Meeting date", "First name", "Last name", "Email", "Checked in"],
    rows: records.map(r => [r.event.title, r.event.date.toISOString().slice(0, 10), ...personCells(r.student), r.checkedInAt.toISOString()]),
  }
}

/** RSVPs to the club's published campus events. RSVP intent is separate from check-in attendance. */
export async function rsvpExport(tx: AppTransactionClient, clubId: string, eventId?: string | null): Promise<ExportTable> {
  const records = await tx.eventRsvp.findMany({
    where: { event: { clubId, publication: { isNot: null } }, ...(eventId ? { eventId } : {}) },
    select: { createdAt: true, event: { select: { title: true, date: true } },
      user: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true } }, applications: anonymousApplicantWhere(clubId) } } },
    orderBy: [{ event: { date: "asc" } }, { createdAt: "asc" }],
  })
  return {
    header: ["Event", "Event date", "First name", "Last name", "Email", "RSVP at"],
    rows: records.map(r => [r.event.title, r.event.date.toISOString().slice(0, 10), ...personCells(r.user), r.createdAt.toISOString()]),
  }
}

