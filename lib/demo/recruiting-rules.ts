import { demoStore } from "./store"
import { applyRuleSchema, buildRulePreview, ruleEligibleStatuses, ruleEventLimit, ruleLabel, ruleScopeSchema, saveRuleSchema, validateRuleRequirement, type RuleThresholds } from "../recruiting-rules"
import type { z } from "zod"

export type DemoRecruitingRule = Omit<RuleThresholds, "requiredEventIds"> & { requiredEventIds?: string[]; roundId: string; revision: number; updatedAt: Date }
export type DemoRecruitingFlag = { roundId: string; applicationId: string; ruleRevision: number; reasons: string[]; flaggedBy: string; flaggedAt: Date }
export type DemoRuleAudit = { action: string; roundId: string; actorId: string; at: Date; details: string }
function clubScope(clubId: string) {
  const state = demoStore.get()
  if (state.perspective.role !== "leader" || state.perspective.clubId !== clubId || state.clubs[0].id !== clubId)
    throw new Error("Choose MII's leader workspace first.")
  return state.clubs[0]
}
function roundScope(scope: { clubId: string; roundId: string }) {
  const club = clubScope(scope.clubId)
  if (!club.rounds.some(round => round.id === scope.roundId)) throw new Error("Round unavailable.")
  return club
}
// Demo rules saved before attendance rules existed have no event list.
function withEvents(rule: DemoRecruitingRule | undefined) { return rule ? { ...rule, requiredEventIds: rule.requiredEventIds ?? [] } : null }
export function getRecruitingRules(clubId: string) {
  const club = clubScope(clubId), state = demoStore.get()
  const events = (state.meetings ?? []).filter(m => m.clubId === clubId && m.audience === "RECRUITMENT").sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, ruleEventLimit).map(m => ({ id: m.id, title: m.title, date: new Date(m.date) }))
  return { rounds: club.rounds.map(round => ({ id: round.id, name: round.name, anonymousReview: round.anonymousReview, screeningRule: withEvents(state.recruitingRules.find(rule => rule.roundId === round.id)) })), events, testRequirement: club.testRequirement, canIdentify: true, canPreview: true, canApply: true }
}
export function saveRecruitingRule(input: z.infer<typeof saveRuleSchema>) {
  const parsed = saveRuleSchema.parse(input), club = roundScope(parsed)
  validateRuleRequirement(parsed.thresholds, club.testRequirement)
  const clubEvents = new Set((demoStore.get().meetings ?? []).filter(m => m.clubId === parsed.clubId).map(m => m.id))
  if (!parsed.thresholds.requiredEventIds.every(id => clubEvents.has(id))) throw new Error("Choose events from this club.")
  return demoStore.mutate(state => {
    const existing = state.recruitingRules.find(rule => rule.roundId === parsed.roundId)
    if ((existing?.revision ?? 0) !== parsed.expectedRevision) throw new Error("Rules changed. Reload before saving.")
    const rule = { ...parsed.thresholds, roundId: parsed.roundId, revision: parsed.expectedRevision + 1, updatedAt: new Date() }
    state.recruitingRules = [...state.recruitingRules.filter(rule => rule.roundId !== parsed.roundId), rule]
    state.recruitingFlags = state.recruitingFlags.filter(flag => flag.roundId !== parsed.roundId)
    state.recruitingRuleAudit.push({ action: "recruiting.rules.save", roundId: parsed.roundId, actorId: state.students[0].id, at: new Date(), details: JSON.stringify({ before: existing ?? null, after: rule }) })
    return rule
  })
}
export async function previewRecruitingRule(input: z.infer<typeof ruleScopeSchema>) {
  const scope = ruleScopeSchema.parse(input), club = roundScope(scope), state = demoStore.get()
  const rule = withEvents(state.recruitingRules.find(rule => rule.roundId === scope.roundId))
  if (!rule) throw new Error("Save this round's rules before previewing.")
  const now = Date.now()
  const heldEventIds = (state.meetings ?? []).filter(m => m.clubId === scope.clubId && rule.requiredEventIds.includes(m.id) && +new Date(m.date) <= now).map(m => m.id)
  const candidates = state.applications.filter(app => app.clubId === scope.clubId && app.roundId === scope.roundId && ruleEligibleStatuses.includes(app.status)).map(app => {
    const profile = state.students.find(student => student.id === app.studentId)?.profile
    const attendedEventIds = (state.meetingAttendances ?? []).filter(a => a.studentId === app.studentId && heldEventIds.includes(a.eventId)).map(a => a.eventId)
    return { id: app.id, status: app.status, gpa: profile?.gpa ?? null, satScore: profile?.satScore ?? null, actScore: profile?.actScore ?? null, ...(heldEventIds.length ? { attendedEventIds } : {}) }
  })
  return buildRulePreview(scope, rule.revision, { minGpa: rule.minGpa, minSat: rule.minSat, minAct: rule.minAct, requiredEventIds: rule.requiredEventIds }, club.testRequirement, candidates, { heldEventIds })
}
export async function applyRecruitingRuleFlags(input: z.infer<typeof applyRuleSchema>) {
  const parsed = applyRuleSchema.parse(input)
  // Hashing is async; ensure the store has not changed during the preview.
  const before = demoStore.get(), fresh = await previewRecruitingRule(parsed)
  if (before !== demoStore.get() || fresh.fingerprint !== parsed.fingerprint) throw new Error("Applicants or rules changed. Preview again before applying flags.")
  roundScope(parsed)
  return demoStore.mutate(state => {
    const matches = fresh.results.filter(result => result.outcome === "flag")
    state.recruitingFlags = [...state.recruitingFlags.filter(flag => flag.roundId !== parsed.roundId), ...matches.map(result => ({ roundId: parsed.roundId, applicationId: result.id, ruleRevision: fresh.revision, reasons: result.reasons, flaggedBy: state.students[0].id, flaggedAt: new Date() }))]
    state.recruitingRuleAudit.push({ action: "recruiting.rules.flag", roundId: parsed.roundId, actorId: state.students[0].id, at: new Date(), details: JSON.stringify({ fingerprint: fresh.fingerprint, applicationIds: matches.map(result => result.id) }) })
    return { flagged: matches.length }
  })
}
export function getRecruitingRuleFlags(input: z.infer<typeof ruleScopeSchema>) {
  const scope = ruleScopeSchema.parse(input); roundScope(scope)
  const state = demoStore.get()
  return state.recruitingFlags.filter(flag => flag.roundId === scope.roundId && state.applications.some(app => app.id === flag.applicationId && app.clubId === scope.clubId && app.roundId === scope.roundId && ruleEligibleStatuses.includes(app.status))).map(flag => ({ applicationId: flag.applicationId, ruleRevision: flag.ruleRevision, reasons: flag.reasons, flaggedAt: flag.flaggedAt, label: ruleLabel(flag.applicationId) }))
}
export function clearRecruitingRuleFlags(input: z.infer<typeof ruleScopeSchema>) {
  const scope = ruleScopeSchema.parse(input); roundScope(scope)
  return demoStore.mutate(state => {
    state.recruitingFlags = state.recruitingFlags.filter(flag => flag.roundId !== scope.roundId)
    state.recruitingRuleAudit.push({ action: "recruiting.rules.clear", roundId: scope.roundId, actorId: state.students[0].id, at: new Date(), details: "{}" })
    return { success: true }
  })
}
