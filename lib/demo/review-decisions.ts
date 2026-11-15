// Demo Mode grading categories and staged decisions. Same rules as actions/review-decisions.ts
// (lib/review-rubric.ts, lib/staged-decisions.ts); fictional data only, nothing leaves the browser.
import { demoStore, demoMember } from "./store"
import * as demoOffers from "./recruitment-offers"
import { hasPermission } from "@/lib/permissions"
import { normalizeReviewRubric, reviewRubricSchema, type ReviewRubric } from "@/lib/review-rubric"
import { resolveStagedTarget, stagedIsStale, stagedOutcomes, type StagedDecisionView, type StagedOutcome, type StagedTarget } from "@/lib/staged-decisions"
import { z } from "zod"
import { anonymousApplicantLabel } from "@/lib/anonymous-review"

export type DemoStagedDecision = { id: string; clubId: string; applicationId: string; outcome: StagedOutcome; targetStatus: StagedTarget["targetStatus"]; targetRoundId: string | null; expectedStatus: string; expectedRoundId: string; stagedById: string; createdAt: string }

function leaderClub(clubId: string) {
  const s = demoStore.get()
  if (s.perspective.role !== "leader" || s.perspective.clubId !== clubId || clubId !== s.clubs[0].id) throw new Error("Choose this club's leader perspective first.")
  return s.clubs[0]
}
const demoRounds = (clubId: string) => leaderClub(clubId).rounds.filter(r => !("archivedAt" in r) || !r.archivedAt).map((r, index) => ({ id: r.id, name: r.name, order: "order" in r && typeof r.order === "number" ? r.order : index, type: /interview/i.test(r.name) ? "INTERVIEW" : "CUSTOM" }))
function decider(clubId: string) {
  leaderClub(clubId)
  const member = demoMember()
  if (!hasPermission(member, "decisions.manage") || !hasPermission(member, "applicants.identify")) throw new Error("You do not have permission for this club action.")
  return member
}
function present(row: DemoStagedDecision, memberId: string): StagedDecisionView {
  const s = demoStore.get(), app = s.applications.find(a => a.id === row.applicationId), club = s.clubs.find(c => c.id === row.clubId)
  const round = club?.rounds.find(r => r.id === app?.roundId), student = s.students.find(u => u.id === app?.studentId)
  return { ...row, expectedStatus: row.expectedStatus as StagedDecisionView["expectedStatus"], stagedBy: row.stagedById === memberId ? "You" : "Club reviewer", stagedByMe: row.stagedById === memberId,
    applicant: round?.anonymousReview ? anonymousApplicantLabel(row.applicationId) : student ? `${student.profile.firstName} ${student.profile.lastName}` : "Applicant",
    roundName: round?.name ?? "", targetRoundName: row.targetRoundId ? club?.rounds.find(r => r.id === row.targetRoundId)?.name ?? null : null }
}

export function demoReviewRubric(clubId: string): ReviewRubric {
  return normalizeReviewRubric(demoStore.get().reviewRubric?.[clubId])
}
export function getReviewRubric(clubId: string) {
  leaderClub(clubId)
  return { rubric: demoReviewRubric(clubId), configured: !!demoStore.get().reviewRubric?.[clubId] }
}
export function saveReviewRubric(input: { clubId: string; rubric: ReviewRubric }) {
  leaderClub(input.clubId)
  if (!hasPermission(demoMember(), "recruitment.manage")) throw new Error("You do not have permission for this club action.")
  const rubric = reviewRubricSchema.parse(input.rubric)
  demoStore.mutate(s => { s.reviewRubric = { ...(s.reviewRubric ?? {}), [input.clubId]: rubric } })
  return { rubric }
}
export function listStagedDecisions(clubId: string) {
  const member = decider(clubId)
  return (demoStore.get().stagedDecisions ?? []).filter(row => row.clubId === clubId).map(row => present(row, member.id))
}
const stageInput = z.object({ clubId: z.string(), applicationId: z.string(), outcome: z.enum(stagedOutcomes), roundId: z.string().optional(), expectedStatus: z.string(), expectedRoundId: z.string() }).strict()
export function stageDecision(input: z.input<typeof stageInput>) {
  const data = stageInput.parse(input), member = decider(data.clubId), rounds = demoRounds(data.clubId)
  return demoStore.mutate(s => {
    const app = s.applications.find(a => a.id === data.applicationId && a.clubId === data.clubId && a.status !== "DRAFTING")
    if (!app) throw new Error("Application unavailable.")
    if (app.studentId === member.userId) throw new Error("You can't decide your own application.")
    if (app.status !== data.expectedStatus || app.roundId !== data.expectedRoundId) throw new Error("Application changed. Reload the page and try again.")
    const target = resolveStagedTarget(app, rounds, data.outcome, data.roundId)
    const previous = (s.stagedDecisions ?? []).find(row => row.applicationId === app.id)
    const row: DemoStagedDecision = { id: previous?.id ?? crypto.randomUUID(), clubId: data.clubId, applicationId: app.id, outcome: data.outcome, ...target, expectedStatus: app.status, expectedRoundId: app.roundId, stagedById: member.id, createdAt: previous?.createdAt ?? new Date().toISOString() }
    s.stagedDecisions = [...(s.stagedDecisions ?? []).filter(item => item.applicationId !== app.id), row]
    return present(row, member.id)
  })
}
export function clearStagedDecision(input: { clubId: string; applicationId: string; stagedId?: string }) {
  decider(input.clubId)
  return demoStore.mutate(s => {
    const before = (s.stagedDecisions ?? []).length
    s.stagedDecisions = (s.stagedDecisions ?? []).filter(row => !(row.clubId === input.clubId && row.applicationId === input.applicationId && (!input.stagedId || row.id === input.stagedId)))
    return { cleared: before - s.stagedDecisions.length }
  })
}
export function sendStagedDecisions(input: { clubId: string; applicationIds: string[]; confirmed: true }) {
  const member = decider(input.clubId), rounds = demoRounds(input.clubId), ids = new Set(input.applicationIds)
  return demoStore.mutate(s => {
    const out = { sent: 0, stale: [] as { applicationId: string; reason: string }[] }
    for (const row of (s.stagedDecisions ?? []).filter(item => item.clubId === input.clubId && ids.has(item.applicationId))) {
      const app = s.applications.find(a => a.id === row.applicationId)
      if (!app || app.status === "DRAFTING") { out.stale.push({ applicationId: row.applicationId, reason: "no longer available" }); continue }
      if (stagedIsStale(row, app)) { out.stale.push({ applicationId: row.applicationId, reason: "changed since the decision was staged" }); continue }
      if (row.targetRoundId) {
        if (!hasPermission(member, "recruitment.manage")) { out.stale.push({ applicationId: row.applicationId, reason: "moving rounds needs recruitment management access" }); continue }
        if (!rounds.some(r => r.id === row.targetRoundId)) { out.stale.push({ applicationId: row.applicationId, reason: "its target round is no longer active" }); continue }
        app.roundId = row.targetRoundId; app.status = row.targetStatus
      } else if (row.targetStatus !== app.status) demoOffers.demoDecision(s, app.id, row.targetStatus)
      s.stagedDecisions = (s.stagedDecisions ?? []).filter(item => item.id !== row.id)
      out.sent++
    }
    return out
  })
}
