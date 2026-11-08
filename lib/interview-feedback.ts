/** Read-only, round-scoped interview feedback built from finalized material only:
 * submitted evaluations (score) and completed records with a submitted evaluation
 * (final interview thoughts). Callers must pass rounds that are already authorized
 * for the viewer (see authorizedInterviewRounds / the Demo mirror). */
export type InterviewFeedbackEntry = { id: string; interviewer: string; summary: string | null; score: number | null };
export type InterviewFeedbackReference = { roundId: string; roundName: string; submitted: number };
export type InterviewFeedback = {
  roundId: string; roundName: string;
  entries: InterviewFeedbackEntry[];
  /** Assigned interviewers who have not submitted. A count only: never names or scores. */
  pending: number;
  scoresIncluded: boolean;
  /** Earlier authorized rounds, as labelled references only. Never merged into entries. */
  earlierRounds: InterviewFeedbackReference[];
};
export type InterviewFeedbackResult = { status: "ready"; feedback: InterviewFeedback | null } | { status: "unavailable" };

type Round = { id: string; name: string };
type SubmittedReview = { id: string; roundId: string | null; interviewerId: string; score: number; submittedAt: Date | string | null; interviewer: string };
type FinalSummary = { roundId: string; interviewerId: string; text: string };

const validScore = (score: number) => Number.isFinite(score) && score >= 1 && score <= 10;

/** Requested round when it is authorized; otherwise the latest (by round order) authorized round with a submitted evaluation. */
export function feedbackRound<R extends Round>(allowed: readonly R[], requestedRoundId: string | undefined, reviews: readonly { roundId: string | null; submittedAt: Date | string | null }[]): R | null {
  const requested = requestedRoundId ? allowed.find(r => r.id === requestedRoundId) : undefined;
  if (requested) return requested;
  for (let i = allowed.length - 1; i >= 0; i--) if (reviews.some(r => r.submittedAt && r.roundId === allowed[i].id)) return allowed[i];
  return null;
}

/** `allowed` must be ordered by round order. One entry per interviewer, deduplicated like the canonical score path. */
export function buildInterviewFeedback(input: {
  allowed: readonly Round[]; requestedRoundId?: string; reviews: readonly SubmittedReview[]; summaries: readonly FinalSummary[];
  pendingMemberIds: readonly string[]; includeScores: boolean;
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
  const earlierRounds = input.allowed.slice(0, index).flatMap(r => {
    const submitted = new Set(input.reviews.filter(v => v.submittedAt && v.roundId === r.id).map(v => v.interviewerId)).size;
    return submitted ? [{ roundId: r.id, roundName: r.name, submitted }] : [];
  });
  return {
    roundId: round.id, roundName: round.name,
    entries,
    pending: new Set(input.pendingMemberIds.filter(id => !seen.has(id))).size,
    scoresIncluded: input.includeScores, earlierRounds,
  };
}

export const interviewFeedbackEmpty = (roundName: string) => `No interview feedback has been submitted for ${roundName} yet.`;
export const interviewFeedbackPending = (pending: number) => `${pending} review${pending === 1 ? "" : "s"} not yet submitted`;
