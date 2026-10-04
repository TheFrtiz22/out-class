import { z } from "zod"
import { votingDisplaySchema, defaultVotingDisplay } from "@/lib/voting-presentation"
export const decisionSchema = z.enum(["PASS", "HOLD", "NOT_PASS"])
export type Decision = z.infer<typeof decisionSchema>
export type Outcome = Decision | "UNRESOLVED"
export function ballotOutcome(ballots: { decision: string }[], participants: number, rule: string, threshold: number): { outcome: Outcome; automatic: boolean } {
  const count = (d: string) => ballots.filter(b => b.decision === d).length
  if (participants < 1) return { outcome: "UNRESOLVED", automatic: false }
  const automatic = rule === "UNANIMOUS" ? count("PASS") === participants : rule === "THRESHOLD" && count("PASS") * 100 >= participants * threshold
  if (automatic) return { outcome: "PASS", automatic: true }
  if (ballots.length !== participants) return { outcome: "UNRESOLVED", automatic: false }
  for (const outcome of ["PASS", "HOLD", "NOT_PASS"] as const) if (count(outcome) > participants / 2) return { outcome, automatic: false }
  return { outcome: "HOLD", automatic: false }
}
export function summarizeVoting(session: { participants: unknown[]; targetSize: number; autoAdvance: string; threshold: number; candidates: { applicationId: string }[]; passes: { number: number; candidates: { applicationId: string; override: string | null; ballots: { decision: string }[] }[] }[] }) {
  const outcomes = session.candidates.map(c => {
    const pass = [...session.passes].sort((a,b) => b.number-a.number).find(p => p.candidates.some(v => v.applicationId === c.applicationId))
    const entry = pass?.candidates.find(v => v.applicationId === c.applicationId)
    const result = entry ? ballotOutcome(entry.ballots, session.participants.length, session.autoAdvance, session.threshold) : { outcome: "UNRESOLVED" as Outcome, automatic: false }
    return { applicationId: c.applicationId, passNumber: pass?.number ?? 0, outcome: (entry?.override ?? result.outcome) as Outcome, automatic: !entry?.override && result.automatic }
  })
  const count = (d: Outcome) => outcomes.filter(o => o.outcome === d).length
  return { outcomes, total: outcomes.length, passed: count("PASS"), held: count("HOLD"), notPassed: count("NOT_PASS"), unresolved: count("UNRESOLVED"), remaining: count("UNRESOLVED"), processed: outcomes.length-count("UNRESOLVED"), target: session.targetSize, targetReached: count("PASS") >= session.targetSize }
}
export const createVotingSchema = z.object({ clubId: z.string().uuid(), roundId: z.string().uuid(), applicationIds: z.array(z.string().uuid()).min(1).max(2000), participantIds: z.array(z.string().uuid()).min(1).max(500), targetSize: z.number().int().min(1).max(2000), displayConfig: votingDisplaySchema.default(defaultVotingDisplay), autoAdvance: z.enum(["NONE", "UNANIMOUS", "THRESHOLD"]).default("NONE"), threshold: z.number().int().min(51).max(100).default(100) }).strict()
export const votingScope = z.object({ clubId: z.string().uuid(), sessionId: z.string().uuid() }).strict()
export const votingCommandSchema = votingScope.extend({ revision: z.number().int().min(0), action: z.enum(["OPEN_JOIN", "SET_CANDIDATE", "START_PASS", "COMPLETE_PASS", "PAUSE", "RESUME", "FINISH", "REOPEN", "OVERRIDE", "CONFIGURE", "PUBLISH"]), applicationIds: z.array(z.string().uuid()).min(1).max(2000).optional(), applicationId: z.string().uuid().optional(), decision: decisionSchema.optional(), reason: z.string().trim().min(1).max(1000).optional(), displayConfig: votingDisplaySchema.optional(), targetSize: z.number().int().min(1).max(2000).optional() }).strict()
