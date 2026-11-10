import type { AppTransactionClient } from "@/utils/prisma"
import type { ClubAccess } from "@/lib/permissions"
import { pipelineSummarySelect, pipelineSummaryProjection } from "@/lib/pipeline-summary"
import { applicationStatusLabel } from "@/lib/application-status"
import type { CsvCell } from "@/lib/csv"
import { defaultProfileFieldVisibility, restrictApplicationProfile, type ProfileFieldVisibility } from "@/lib/profile-field-visibility"

type Member = ClubAccess & { id: string; userId: string }
export type ExportTable = { header: string[]; rows: CsvCell[][] }

/** Applicants through the same privacy projection the pipeline uses: anonymous
 * rounds stay anonymous and only scores this member may already see are included. */
export async function applicantExport(tx: AppTransactionClient, clubId: string, member: Member, profileFields: ProfileFieldVisibility = defaultProfileFieldVisibility()): Promise<ExportTable> {
  const [apps, rounds] = await Promise.all([
    tx.application.findMany({
      where: { clubId, status: { not: "DRAFTING" } },
      select: { ...pipelineSummarySelect, submittedAt: true, recruitmentCycle: { select: { name: true } } },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    }),
    tx.pipelineRound.findMany({ where: { clubId }, select: { id: true, name: true } }),
  ])
  const roundName = new Map(rounds.map(round => [round.id, round.name]))
  // Profile columns the club has hidden are left out entirely, and their values are cleared first.
  // The export carries no GPA, test score, LinkedIn or résumé columns.
  const profileColumns = [
    { field: "major" as const, header: "Major", value: (p: { major?: string } | null) => p?.major ?? "" },
    { field: "academicYear" as const, header: "Year", value: (p: { academicYear?: string } | null) => p?.academicYear ?? "" },
  ].filter(column => profileFields[column.field])
  const header = ["First name", "Last name", "Email", ...profileColumns.map(column => column.header), "Status", "Round", "Cycle", "Submitted", "Average score", "Reviews submitted"]
  const rows = apps.map(app => {
    const view = restrictApplicationProfile(pipelineSummaryProjection(app, member), profileFields)
    const profile = view.student.studentProfile
    return [
      profile?.firstName ?? "", profile?.lastName ?? "", view.student.email, ...profileColumns.map(column => column.value(profile)),
      applicationStatusLabel(view.status), roundName.get(view.roundId) ?? "", app.recruitmentCycle?.name ?? "",
      app.submittedAt ? app.submittedAt.toISOString().slice(0, 10) : "",
      view.roundScore?.average == null ? "" : Math.round(view.roundScore.average * 10) / 10,
      view.roundScore ? view.roundScore.submitted : "",
    ]
  })
  return { header, rows }
}

export async function rosterExport(tx: AppTransactionClient, clubId: string, profileFields: ProfileFieldVisibility = defaultProfileFieldVisibility()): Promise<ExportTable> {
  const members = await tx.clubMember.findMany({
    where: { clubId },
    select: { title: true, status: true, joinedAt: true, cohort: true, isOwner: true, accessRole: true,
      user: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true, gradYear: true } } } } },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
  })
  return {
    // Graduation year is the class-year profile field; it follows the club setting.
    header: ["First name", "Last name", "Email", ...(profileFields.academicYear ? ["Graduation year"] : []), "Title", "Access", "Status", "Cohort", "Joined"],
    rows: members.map(m => [
      m.user.studentProfile?.firstName ?? "", m.user.studentProfile?.lastName ?? "", m.user.email,
      ...(profileFields.academicYear ? [m.user.studentProfile?.gradYear ?? ""] : []), m.title ?? "", m.isOwner ? "Owner" : sentence(m.accessRole),
      sentence(m.status), m.cohort ?? "", m.joinedAt.toISOString().slice(0, 10),
    ]),
  }
}

export async function attendanceExport(tx: AppTransactionClient, clubId: string): Promise<ExportTable> {
  const records = await tx.eventAttendance.findMany({
    where: { event: { clubId } },
    select: { checkedInAt: true, event: { select: { title: true, date: true } },
      student: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true } } } } },
    orderBy: [{ event: { date: "asc" } }, { checkedInAt: "asc" }],
  })
  return {
    header: ["Meeting", "Meeting date", "First name", "Last name", "Email", "Checked in"],
    rows: records.map(r => [
      r.event.title, r.event.date.toISOString().slice(0, 10), r.student.studentProfile?.firstName ?? "",
      r.student.studentProfile?.lastName ?? "", r.student.email, r.checkedInAt.toISOString(),
    ]),
  }
}

function sentence(value: string) { return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ") }
