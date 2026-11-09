/**
 * Target-and-counts summary for round review and the Voting room.
 *
 * Three figures are kept separate on purpose:
 * - the configured target (VotingSession.targetSize / targetUnset; never a new value),
 * - discussion-group counts (ranked-review bands; never decisions),
 * - recorded decision counts (each applicant once, from the canonical confirmed
 *   outcome after Hold re-votes and corrections; never ballots).
 *
 * A target is guidance only: nothing here stops voting, disables Pass or rejects anyone.
 */

export type SummaryOutcome = "ACCEPT" | "HOLD" | "REJECT" | "UNREVIEWED";
export type DecisionCounts = { pass: number; hold: number; notPass: number; unreviewed: number; total: number };
export type SummaryScope = "session" | "round";
export const summaryScopeLabels: Record<SummaryScope, string> = { session: "This session", round: "Entire round" };
export const decisionCountLabels = { pass: "Pass", hold: "Hold", notPass: "Do not pass", unreviewed: "Unreviewed" } as const;

/** A positive integer target, or null for "No target set". Unset, zero, negative and non-integers are never targets. */
export function normalizeTarget(targetSize: number | null | undefined, targetUnset = false): number | null {
  if (targetUnset || typeof targetSize !== "number" || !Number.isInteger(targetSize) || targetSize < 1) return null;
  return targetSize;
}

/**
 * The round is the club's final decision round when no later, non-archived
 * round exists: finalization can then only admit (`ADMISSION`), so the target
 * is a class size. Otherwise passing advances to a later round.
 */
export function targetLabel(round: { name: string; final: boolean } | null | undefined) {
  if (round?.final) return "Final class-size target";
  const name = round?.name?.trim();
  return name ? `Advancement target for ${name}` : "Advancement target";
}

function normalizeOutcome(value: string | null | undefined): SummaryOutcome {
  return value === "ACCEPT" || value === "HOLD" || value === "REJECT" ? value : "UNREVIEWED";
}

/** Counts each applicant once (first canonical entry wins); the input must already be resolved outcomes, never ballots. */
export function decisionCounts(outcomes: readonly { applicationId: string; outcome: string | null }[]): DecisionCounts {
  const seen = new Map<string, SummaryOutcome>();
  for (const o of outcomes) if (!seen.has(o.applicationId)) seen.set(o.applicationId, normalizeOutcome(o.outcome));
  const counts: DecisionCounts = { pass: 0, hold: 0, notPass: 0, unreviewed: 0, total: seen.size };
  for (const outcome of seen.values()) {
    if (outcome === "ACCEPT") counts.pass++;
    else if (outcome === "HOLD") counts.hold++;
    else if (outcome === "REJECT") counts.notPass++;
    else counts.unreviewed++;
  }
  return counts;
}

export type TargetProgress = { target: number | null; passed: number; reached: boolean; over: number; remaining: number; percent: number | null; text: string; detail: string };

/** Plain-text progress. The bar value caps at 100%, the text always shows real numbers and any overage. */
export function targetProgress(passed: number, target: number | null): TargetProgress {
  const safePassed = Math.max(0, Math.trunc(passed) || 0);
  if (target === null) return { target, passed: safePassed, reached: false, over: 0, remaining: 0, percent: null, text: `${safePassed} passed · No target set`, detail: "" };
  const over = Math.max(0, safePassed - target), remaining = Math.max(0, target - safePassed);
  return { target, passed: safePassed, reached: safePassed >= target, over, remaining,
    percent: Math.min(100, Math.round(safePassed * 100 / target)),
    text: `${safePassed} passed · Target ${target}`,
    detail: over > 0 ? `${over} over target` : remaining === 0 ? "Target reached" : `${remaining} to target` };
}

export type TargetSummary = {
  scope: SummaryScope;
  /** Monotonic ordering key (room revision, or the sum of session revisions for a round). */
  revision: number;
  target: { label: string; value: number | null; note?: string };
  decisions: DecisionCounts;
  progress: TargetProgress;
};

/** Session scope: canonical room outcomes (one per roster applicant) and the session's own target. */
export function sessionTargetSummary(input: { revision: number; targetSize: number | null | undefined; targetUnset?: boolean; outcomes: readonly { applicationId: string; outcome: string | null }[]; round: { name: string; final: boolean } | null }): TargetSummary {
  const value = normalizeTarget(input.targetSize, input.targetUnset), decisions = decisionCounts(input.outcomes);
  return { scope: "session", revision: input.revision, target: { label: targetLabel(input.round), value }, decisions, progress: targetProgress(decisions.pass, value) };
}

export type RoundSessionInput = { id: string; createdAt: Date | string; revision: number; targetSize: number | null | undefined; targetUnset?: boolean; outcomes: readonly { applicationId: string; outcome: string | null }[] };

/**
 * One canonical outcome per applicant across a round's sessions: the most
 * recently created session with a recorded outcome wins; an applicant who is
 * only on rosters without a recorded outcome is Unreviewed. Never summed.
 */
export function roundOutcomes(sessions: readonly RoundSessionInput[]) {
  const ordered = [...sessions].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  const result = new Map<string, SummaryOutcome>();
  for (const s of ordered) for (const o of s.outcomes) {
    const outcome = normalizeOutcome(o.outcome);
    if (!result.has(o.applicationId) || (result.get(o.applicationId) === "UNREVIEWED" && outcome !== "UNREVIEWED")) result.set(o.applicationId, outcome);
  }
  return [...result].map(([applicationId, outcome]) => ({ applicationId, outcome }));
}

/** A round target is shown only when every session with a target agrees; differing session targets are never merged or summed. */
export function roundTarget(sessions: readonly Pick<RoundSessionInput, "targetSize" | "targetUnset">[]): { value: number | null; note?: string } {
  const values = [...new Set(sessions.map(s => normalizeTarget(s.targetSize, s.targetUnset)).filter((v): v is number => v !== null))];
  if (values.length === 1) return { value: values[0] };
  if (values.length > 1) return { value: null, note: "Sessions in this round have different targets." };
  return { value: null };
}

export function roundTargetSummary(input: { sessions: readonly RoundSessionInput[]; round: { name: string; final: boolean } | null }): TargetSummary {
  const decisions = decisionCounts(roundOutcomes(input.sessions)), target = roundTarget(input.sessions);
  return { scope: "round", revision: input.sessions.reduce((sum, s) => sum + s.revision, 0),
    target: { label: targetLabel(input.round), value: target.value, ...(target.note ? { note: target.note } : {}) },
    decisions, progress: targetProgress(decisions.pass, target.value) };
}

/** Out-of-order delivery: an older revision never replaces a newer one. */
export function newerByRevision<T extends { revision: number }>(current: T | null | undefined, next: T): T {
  return current && next.revision < current.revision ? current : next;
}

export type BandCounts = { bandsSet: boolean; green: number; yellow: number; red: number; scored: number; notScored: number; hidden: number };

/** Discussion-group counts. Hidden ("score not available") applicants are reported separately, never as Not scored. */
export function bandCounts(input: { banded: readonly { band: "green" | "yellow" | "red" | null }[]; notScored: number; hidden: number; bandsSet: boolean }): BandCounts {
  const count = (band: string) => input.banded.filter(r => r.band === band).length;
  return { bandsSet: input.bandsSet, green: count("green"), yellow: count("yellow"), red: count("red"), scored: input.banded.length, notScored: input.notScored, hidden: input.hidden };
}
