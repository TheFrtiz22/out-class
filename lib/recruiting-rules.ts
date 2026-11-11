import { gpaSchema, supportedGpa } from "@/lib/student-profile"
import { z } from "zod"
import { testRequirements } from "./test-scores"

/** Most events one rule can require, and how many recent recruiting events the editor offers. */
export const ruleEventLimit = 50
export const ruleThresholdSchema = z.object({
  minGpa: gpaSchema.nullable(),
  minSat: z.number().int().min(400).max(1600).multipleOf(10).nullable(),
  minAct: z.number().int().min(1).max(36).nullable(),
  // Recruiting events (info sessions, resume workshops, panels…) an applicant must have checked in to at least one of.
  requiredEventIds: z.array(z.string().uuid()).max(ruleEventLimit).refine(ids => new Set(ids).size === ids.length, "Each event can be selected once.").default([]),
}).strict()
export const ruleScopeSchema = z.object({ clubId: z.string().uuid(), roundId: z.string().uuid() })
export const saveRuleSchema = ruleScopeSchema.extend({
  expectedRevision: z.number().int().nonnegative(),
  thresholds: ruleThresholdSchema,
})
export const applyRuleSchema = ruleScopeSchema.extend({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/) })
export type RuleThresholds = z.infer<typeof ruleThresholdSchema>
export const emptyRuleThresholds: RuleThresholds = { minGpa: null, minSat: null, minAct: null, requiredEventIds: [] }
/** attendedEventIds: the required events this applicant checked in to (only checked when the rule requires attendance). */
export type RuleCandidate = { id: string; status: string; gpa: number | null; satScore: number | null; actScore: number | null; attendedEventIds?: string[] }
/** heldEventIds: the round's required events that have already started. Events still ahead are never counted against anyone. */
export type RuleContext = { heldEventIds: string[] }
export const noRuleContext: RuleContext = { heldEventIds: [] }
export const attendanceReason = "No check-in at any required recruiting event"
export type RuleResult = { id: string; label: string; status: string; outcome: "flag" | "manual" | "clear"; reasons: string[]; missing: string[] }
export const ruleEligibleStatuses = ["SUBMITTED", "IN_REVIEW", "INTERVIEWING"]
export function ruleLabel(id: string) { return `Applicant ${id.replaceAll("-", "").slice(-10).toUpperCase()}` }

export function validateRuleRequirement(thresholds: RuleThresholds, requirement: string) {
  ruleThresholdSchema.parse(thresholds)
  z.enum(testRequirements).parse(requirement)
  if (requirement === "SAT" && thresholds.minAct !== null) throw new Error("ACT thresholds are unavailable for SAT-only recruiting.")
  if (requirement === "ACT" && thresholds.minSat !== null) throw new Error("SAT thresholds are unavailable for ACT-only recruiting.")
  if (requirement === "SAT_OR_ACT" && ((thresholds.minSat === null) !== (thresholds.minAct === null)))
    throw new Error("Set both SAT and ACT thresholds for SAT-or-ACT recruiting, or leave both blank.")
}
export function evaluateRule(thresholds: RuleThresholds, requirement: string, candidate: RuleCandidate, context: RuleContext = noRuleContext): RuleResult {
  validateRuleRequirement(thresholds, requirement)
  const reasons: string[] = [], missing: string[] = []
  function compare(score: number | null, threshold: number | null, min: number, max: number) {
    if (threshold === null) return "unused"
    if (score === null || !Number.isFinite(score) || score < min || score > max) return "missing"
    return score < threshold ? "below" : "meets"
  }
  const gpa = compare(supportedGpa(candidate.gpa), thresholds.minGpa, 0, 4)
  if (gpa === "below") reasons.push(`GPA below ${thresholds.minGpa}`)
  if (gpa === "missing") missing.push("GPA")
  const sat = compare(candidate.satScore, thresholds.minSat, 400, 1600)
  const act = compare(candidate.actScore, thresholds.minAct, 1, 36)
  if ((requirement === "SAT_OR_ACT" || requirement === "OPTIONAL") && thresholds.minSat !== null && thresholds.minAct !== null) {
    // One qualifying score satisfies an either-test rule. A missing alternative is not a failure.
    if (sat !== "meets" && act !== "meets") {
      if (sat === "below" && act === "below") reasons.push(`SAT below ${thresholds.minSat} and ACT below ${thresholds.minAct}`)
      if (sat === "missing") missing.push("SAT")
      if (act === "missing") missing.push("ACT")
    }
  } else {
    if (sat === "below") reasons.push(`SAT below ${thresholds.minSat}`)
    if (act === "below") reasons.push(`ACT below ${thresholds.minAct}`)
    if (sat === "missing") missing.push("SAT")
    if (act === "missing") missing.push("ACT")
  }
  // Attendance: a missing check-in is a definite answer (unlike a missing score), but only once at least one required event has happened.
  const required = new Set(thresholds.requiredEventIds ?? [])
  const held = context.heldEventIds.filter(eventId => required.has(eventId))
  if (held.length && !(candidate.attendedEventIds ?? []).some(eventId => held.includes(eventId))) reasons.push(attendanceReason)
  return { id: candidate.id, label: ruleLabel(candidate.id), status: candidate.status, outcome: reasons.length ? "flag" : missing.length ? "manual" : "clear", reasons, missing }
}
export async function buildRulePreview(scope: { clubId: string; roundId: string }, revision: number, thresholds: RuleThresholds, requirement: string, candidates: RuleCandidate[], context: RuleContext = noRuleContext) {
  validateRuleRequirement(thresholds, requirement)
  const heldEventIds = [...context.heldEventIds].sort()
  const sorted = candidates.filter(c => ruleEligibleStatuses.includes(c.status)).sort((a, b) => a.id.localeCompare(b.id))
    .map(c => c.attendedEventIds ? { ...c, attendedEventIds: [...c.attendedEventIds].sort() } : c)
  const results = sorted.map(c => evaluateRule(thresholds, requirement, c, { heldEventIds }))
  // Held events are part of the fingerprint: if an event starts between preview and apply, the leader previews again.
  const payload = JSON.stringify({ ...scope, revision, thresholds, requirement, candidates: sorted, ...(heldEventIds.length ? { heldEventIds } : {}) })
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload))
  const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("")
  return { revision, fingerprint, results, heldEventCount: heldEventIds.length }
}
export type RulePreview = Awaited<ReturnType<typeof buildRulePreview>>
