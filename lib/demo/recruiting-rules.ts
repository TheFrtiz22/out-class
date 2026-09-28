import { demoStore } from "./store"
import { applyRuleSchema, buildRulePreview, ruleEligibleStatuses, ruleLabel, ruleScopeSchema, saveRuleSchema, validateRuleRequirement, type RuleThresholds } from "../recruiting-rules"
import type { z } from "zod"

export type DemoRecruitingRule = RuleThresholds & { roundId: string; revision: number; updatedAt: Date }
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
export function getRecruitingRules(clubId: string) {
  const club = clubScope(clubId), state = demoStore.get()
  return { rounds: club.rounds.map(round => ({ id: round.id, name: round.name, anonymousReview: round.anonymousReview, screeningRule: state.recruitingRules.find(rule => rule.roundId === round.id) ?? null })), testRequirement: club.testRequirement, canIdentify: true, canPreview: true, canApply: true }
}
export function saveRecruitingRule(input: z.infer<typeof saveRuleSchema>) {
  const parsed = saveRuleSchema.parse(input), club = roundScope(parsed)
  validateRuleRequirement(parsed.thresholds, club.testRequirement)
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
  const rule = state.recruitingRules.find(rule => rule.roundId === scope.roundId)
  if (!rule) throw new Error("Save this round's rules before previewing.")
  const candidates = state.applications.filter(app => app.clubId === scope.clubId && app.roundId === scope.roundId && ruleEligibleStatuses.includes(app.status)).map(app => {
    const profile = state.students.find(student => student.id === app.studentId)?.profile
    return { id: app.id, status: app.status, gpa: profile?.gpa ?? null, satScore: profile?.satScore ?? null, actScore: profile?.actScore ?? null }
  })
  return buildRulePreview(scope, rule.revision, { minGpa: rule.minGpa, minSat: rule.minSat, minAct: rule.minAct }, club.testRequirement, candidates)
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
