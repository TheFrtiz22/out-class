import { z } from "zod"
import type { pipelineListProjection } from "@/lib/pipeline-list"
import { APPLICANT_PAGE_SIZE } from "@/lib/applicant-pagination"
import { compareApplicants } from "@/lib/live-applicant-sorting"
import { compareAcademicYears } from "@/lib/recruitment-profile"
import { applicationDecisionGroup, decisionGroups } from "@/lib/application-decisions"
import { applicantLane, applicantLanes } from "@/lib/applicant-board"
import { genderValues } from "@/lib/student-profile"

// Cursor scope is an equality check, never authorization. Every page and full
// selection runs the original live guard and canonical privacy projection.
const cursorSchema = z.object({ id: z.string().uuid(), direction: z.enum(["after", "before", "at"]), scope: z.string().min(1).max(4096) }).strict()
export const pipelinePageQuery = z.object({
  query: z.string().max(200).default(""),
  roundId: z.string().uuid().optional(),
  gender: z.enum(genderValues).optional(), genderCounts: z.boolean().default(false),
  mode: z.enum(["applicants", "decisions", "rejected"]).default("applicants"),
  decisionGroup: z.enum(["pending", "accepted", "waitlisted", "rejected"]).default("pending"),
  status: z.enum(["SUBMITTED", "IN_REVIEW", "INTERVIEWING", "ACCEPTED", "REJECTED", "WAITLISTED"]).optional(),
  review: z.enum(["unreviewed", "mine"]).optional(),
  major: z.string().max(200).optional(), year: z.string().max(100).optional(),
  gpa: z.number().finite().min(0).max(4).optional(),
  sat: z.number().int().min(0).max(1600).optional(), act: z.number().int().min(0).max(36).optional(),
  rating: z.number().finite().min(0).max(10).optional(),
  sort: z.enum(["name", "round", "year", "gpa", "sat", "act", "status", "score"]).default("name"),
  descending: z.boolean().default(false), cursor: cursorSchema.optional(),
}).strict()
export type PipelinePageQuery = z.input<typeof pipelinePageQuery>
export type PipelineCursor = z.infer<typeof cursorSchema>
type List = ReturnType<typeof pipelineListProjection>
type Candidate = List["applications"][number]
export type PipelineSelection = Pick<Candidate, "id" | "roundId" | "status"> & { canQuickReview: boolean }
const applicantName = (app: Candidate) => app.student.studentProfile ? `${app.student.studentProfile.firstName} ${app.student.studentProfile.lastName}` : app.student.email

export function pipelineSelectionKey(input: PipelinePageQuery) {
  const { cursor: _cursor, ...query } = pipelinePageQuery.parse(input)
  return JSON.stringify(query)
}

/** Filtering observes only fields already released by the canonical projector.
 * Raw identity, unsubmitted evaluations and hidden ratings cannot affect matches.
 * This scan remains O(N); the wire response and rendered page are bounded. */
function selectPipeline(data: List, input: PipelinePageQuery, reviewerId: string, userId: string) {
  const q = pipelinePageQuery.parse(input)
  const base = data.applications.filter(a => q.mode === "rejected" ? a.status === "REJECTED" : q.mode === "decisions" || a.status !== "REJECTED")
  const filtered = base.filter(app => {
    const profile = app.student.studentProfile
    return `${applicantName(app)} ${app.student.email} ${profile?.major || ""}`.toLowerCase().includes(q.query.trim().toLowerCase()) &&
      (!q.roundId || app.roundId === q.roundId) && (!q.status || app.status === q.status) &&
      (q.mode !== "decisions" || applicationDecisionGroup(app.status) === q.decisionGroup) &&
      (!q.major || profile?.major === q.major) && (!q.year || profile?.academicYear === q.year) &&
      (q.gpa === undefined || profile?.gpa != null && profile.gpa > q.gpa) &&
      (q.sat === undefined || profile?.satScore != null && profile.satScore > q.sat) &&
      (q.act === undefined || profile?.actScore != null && profile.actScore > q.act) &&
      (q.rating === undefined || app.roundScore?.average != null && app.roundScore.average >= q.rating) &&
      (!q.review || (q.review === "unreviewed" ? app.evaluations.length === 0 : app.evaluations.some(e => e.interviewerId === reviewerId)))
  }).sort((a, b) => compareApplicants(a, b, q.sort, q.descending, data.rounds))
  const canQuickReview = (app: Candidate) => !["ACCEPTED", "REJECTED", "WAITLISTED", "DRAFTING"].includes(app.status) && !app.studentId.startsWith("anonymous-") && app.studentId !== userId
  return { q, base, filtered, canQuickReview }
}

export function completePipelineSelection(data: List, input: PipelinePageQuery, reviewerId: string, userId: string): { applications: PipelineSelection[] } {
  const { filtered, canQuickReview } = selectPipeline(data, input, reviewerId, userId)
  return { applications: filtered.map(app => ({ id: app.id, roundId: app.roundId, status: app.status, canQuickReview: canQuickReview(app) })) }
}

export function pagePipeline(data: List, input: PipelinePageQuery, reviewerId: string, userId: string, scope: string) {
  const { q, base, filtered, canQuickReview } = selectPipeline(data, input, reviewerId, userId)
  if (q.cursor && q.cursor.scope !== scope) throw new z.ZodError([{ code: "custom", path: ["cursor"], message: "Applicant selection changed. Restart pagination." }])
  const anchor = q.cursor ? filtered.findIndex(a => a.id === q.cursor!.id) : -1
  const reset = !!q.cursor && anchor < 0
  const start = anchor < 0 ? 0 : q.cursor?.direction === "after" ? anchor + 1 : q.cursor?.direction === "before" ? Math.max(0, anchor - APPLICANT_PAGE_SIZE) : Math.floor(anchor / APPLICANT_PAGE_SIZE) * APPLICANT_PAGE_SIZE
  const applications = filtered.slice(start, start + APPLICANT_PAGE_SIZE)
  const cursor = (id: string, direction: PipelineCursor["direction"]): PipelineCursor => ({ id, direction, scope })
  return {
    rounds: data.rounds, genderCounts: data.genderCounts, applications,
    page: { scope, start, total: filtered.length, baseTotal: base.length, index: Math.floor(start / APPLICANT_PAGE_SIZE), count: Math.max(1, Math.ceil(filtered.length / APPLICANT_PAGE_SIZE)), reset,
      previous: start > 0 && applications.length ? cursor(applications[0].id, "before") : null,
      next: start + applications.length < filtered.length && applications.length ? cursor(applications.at(-1)!.id, "after") : null },
    facets: {
      majors: [...new Set(base.map(a => a.student.studentProfile?.major).filter((v): v is string => !!v))].sort(),
      years: [...new Set(base.flatMap(a => a.student.studentProfile ? [a.student.studentProfile.academicYear] : []))].sort(compareAcademicYears),
      decisions: Object.fromEntries(decisionGroups.map(g => [g.id, base.filter(a => applicationDecisionGroup(a.status) === g.id).length])),
      lanes: Object.fromEntries(applicantLanes.map(l => [l.id, filtered.filter(a => applicantLane(a.status) === l.id).length])),
      quickReview: filtered.filter(canQuickReview).length,
    },
  }
}
