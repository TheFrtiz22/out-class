/** Read-only, round-scoped interview feedback built from finalized material only:
 * submitted evaluations (score) and completed records with a submitted evaluation
 * (final interview thoughts). Callers must pass rounds that are already authorized
 * for the viewer (see authorizedInterviewRounds / the Demo mirror). */
import { submittedScoreSummary } from "@/lib/interview-review-summary";
export type InterviewFeedbackEntry = { id: string; interviewer: string; summary: string | null; score: number | null };
/** Where an earlier-round record came from: a completed interview-kit record, or a submitted evaluation without one. */
export type EvidenceSource = "kit" | "evaluation";
export const evidenceSourceLabels: Record<EvidenceSource, string> = { kit: "Interview kit", evaluation: "Evaluation" };
export type EarlierRoundEntry = { id: string; interviewer: string; summary: string | null; score: number | null; source: EvidenceSource };
/** One earlier authorized round, kept as its own labelled group: never merged into the current round's entries, average or ranking. */
export type EarlierRound = { roundId: string; roundName: string; submitted: number; average: number | null; entries: EarlierRoundEntry[] };
export type InterviewFeedbackReference = EarlierRound;
export type InterviewFeedback = {
  roundId: string; roundName: string;
  entries: InterviewFeedbackEntry[];
  /** Assigned interviewers who have not submitted. A count only: never names or scores. */
  pending: number;
  scoresIncluded: boolean;
  /** Equal-weight average of valid submitted scores in this round (canonical submittedScoreSummary); null when none or scores withheld. */
  average: number | null;
  /** Scored, submitted evaluations behind `average`. */
  scored: number;
  /** Earlier authorized rounds, each labelled with its own round. Never merged into entries or `average`. */
  earlierRounds: EarlierRound[];
};
export type InterviewFeedbackResult = { status: "ready"; feedback: InterviewFeedback | null } | { status: "unavailable" };

type Round = { id: string; name: string };
type SubmittedReview = { id: string; roundId: string | null; interviewerId: string; score: number; submittedAt: Date | string | null; interviewer: string };
type FinalSummary = { roundId: string; interviewerId: string; text: string };
/** Completed, non-anonymous interview records (the kit workflow) behind submitted evaluations. */
export type KitRecord = { roundId: string; interviewerId: string };

const validScore = (score: number) => Number.isFinite(score) && score >= 1 && score <= 10;

/** Requested round when it is authorized; otherwise the latest (by round order) authorized round with a submitted evaluation. */
export function feedbackRound<R extends Round>(allowed: readonly R[], requestedRoundId: string | undefined, reviews: readonly { roundId: string | null; submittedAt: Date | string | null }[]): R | null {
  const requested = requestedRoundId ? allowed.find(r => r.id === requestedRoundId) : undefined;
  if (requested) return requested;
  for (let i = allowed.length - 1; i >= 0; i--) if (reviews.some(r => r.submittedAt && r.roundId === allowed[i].id)) return allowed[i];
  return null;
}

/**
 * Earlier rounds as their own labelled groups. `rounds` must already be authorized
 * and ordered. Individual scores only with `includeScores`, the round's own average
 * only with `includeAverage`, summaries only with `includeSummaries`. Rounds without
 * a submitted evaluation are omitted; a missing score is null, never zero.
 */
export function earlierRoundEvidence(input: {
  rounds: readonly Round[]; reviews: readonly SubmittedReview[]; summaries: readonly FinalSummary[]; kitRecords?: readonly KitRecord[];
  includeScores: boolean; includeAverage: boolean; includeSummaries: boolean;
}): EarlierRound[] {
  return input.rounds.flatMap(r => {
    const seen = new Set<string>(), entries: EarlierRoundEntry[] = [];
    for (const review of input.reviews) {
      if (!review.submittedAt || review.roundId !== r.id || seen.has(review.interviewerId)) continue;
      seen.add(review.interviewerId);
      const summary = input.includeSummaries ? input.summaries.find(s => s.roundId === r.id && s.interviewerId === review.interviewerId && s.text.trim())?.text ?? null : null;
      const source: EvidenceSource = input.kitRecords?.some(k => k.roundId === r.id && k.interviewerId === review.interviewerId) ? "kit" : "evaluation";
      entries.push({ id: review.id, interviewer: review.interviewer, summary, score: input.includeScores && validScore(review.score) ? review.score : null, source });
    }
    if (!seen.size) return [];
    entries.sort((a, b) => a.interviewer.localeCompare(b.interviewer) || a.id.localeCompare(b.id));
    const average = input.includeAverage ? submittedScoreSummary(input.reviews.filter(v => v.roundId === r.id), []).average : null;
    // Entries carry content only when a summary or an individual score may be shown.
    return [{ roundId: r.id, roundName: r.name, submitted: seen.size, average, entries: input.includeScores || input.includeSummaries ? entries : [] }];
  });
}

/** `allowed` must be ordered by round order. One entry per interviewer, deduplicated like the canonical score path. */
export function buildInterviewFeedback(input: {
  allowed: readonly Round[]; requestedRoundId?: string; reviews: readonly SubmittedReview[]; summaries: readonly FinalSummary[];
  pendingMemberIds: readonly string[]; includeScores: boolean; kitRecords?: readonly KitRecord[];
}): InterviewFeedback | null {
  const round = feedbackRound(input.allowed, input.requestedRoundId, input.reviews);
  if (!round) return null;
  const seen = new Set<string>(), entries: InterviewFeedbackEntry[] = [];
  for (const review of input.reviews) {
    if (!review.submittedAt || review.roundId !== round.id || seen.has(review.interviewerId)) continue;
    seen.add(review.interviewerId);
    const summary = input.summaries.find(s => s.roundId === round.id && s.interviewerId === review.interviewerId && s.text.trim());
    entries.push({ id: review.id, interviewer: review.interviewer, summary: summary?.text ?? null, score: input.includeScores && validScore(review.score) ? review.score : null });
  }
  entries.sort((a, b) => a.interviewer.localeCompare(b.interviewer) || a.id.localeCompare(b.id));
  const index = input.allowed.findIndex(r => r.id === round.id);
  const earlierRounds = earlierRoundEvidence({ rounds: input.allowed.slice(0, index), reviews: input.reviews, summaries: input.summaries, kitRecords: input.kitRecords,
    includeScores: input.includeScores, includeAverage: input.includeScores, includeSummaries: true });
  const summary = input.includeScores ? submittedScoreSummary(input.reviews.filter(r => r.roundId === round.id), []) : null;
  return {
    roundId: round.id, roundName: round.name,
    entries,
    average: summary?.average ?? null, scored: summary?.submitted ?? 0,
    pending: new Set(input.pendingMemberIds.filter(id => !seen.has(id))).size,
    scoresIncluded: input.includeScores, earlierRounds,
  };
}

export const interviewFeedbackEmpty = (roundName: string) => `No interview feedback has been submitted for ${roundName} yet.`;
/** Wherever a round has no qualifying interview score, including rounds before interviews. Never shown as zero. */
export const NO_INTERVIEW_SCORES = "No interview scores for this round.";
export const interviewFeedbackPending = (pending: number) => `${pending} review${pending === 1 ? "" : "s"} not yet submitted`;
