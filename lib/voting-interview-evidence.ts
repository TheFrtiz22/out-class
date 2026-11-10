import { submittedScoreSummary } from "@/lib/interview-review-summary";
import { buildInterviewFeedback, earlierRoundEvidence, type EarlierRound, type InterviewFeedback, type KitRecord } from "@/lib/interview-feedback";

export type VotingInterviewRound = { id: string; name: string };
/** The voting round's own interview score. `none`: no qualifying submitted score (or not an interview round);
 * `withheld`: an interview round this viewer may not read yet. Never zero, never another round's score. */
export type CurrentRoundScore = { roundId: string; roundName: string; status: "scored" | "none" | "withheld"; average: number | null; submitted: number };
export type VotingInterviewScore = {
  average: number | null; submitted: number; rounds: number;
  scale: "1–10"; scope: string; withheld: boolean;
  byRound: { roundId: string; roundName: string; average: number; submitted: number }[];
  /** Present in round-scoped (voting) reads only. */
  current?: CurrentRoundScore;
};
export type VotingInterviewThought = { id: string; roundId: string; roundName: string; interviewer: string; text: string };

/** Input must already be authorized identified INTERVIEW/GROUP_INTERVIEW rounds.
 * Canonical aggregation excludes missing/invalid scores and deduplicates each
 * interviewer within each stable round. Never mix generic application ratings. */
export function votingScoreEvidence(rounds: VotingInterviewRound[], reviews: {roundId: string | null; interviewerId: string; score: number; submittedAt: Date | string | null}[]): VotingInterviewScore {
  const scoped = reviews.filter(r => rounds.some(round => round.id === r.roundId));
  const summary = submittedScoreSummary(scoped.map(r => ({...r, interviewerId: `${r.roundId}:${r.interviewerId}`})), []);
  const byRound = rounds.flatMap(round => {
    const value = submittedScoreSummary(scoped.filter(r => r.roundId === round.id), []);
    return value.average === null ? [] : [{roundId: round.id, roundName: round.name, average: value.average, submitted: value.submitted}];
  });
  return {average: summary.average, submitted: summary.submitted, rounds: byRound.length, byRound, scale: "1–10",
    scope: "Submitted 1–10 interview evaluations across authorized identified interview rounds; weighted by evaluation count", withheld: !rounds.length};
}

type OrderedRound = VotingInterviewRound & { order: number };
type Review = { id: string; roundId: string | null; interviewerId: string; score: number; submittedAt: Date | string | null; interviewer: string };
export type RoundScopedEvidence = {
  interviewScore?: VotingInterviewScore;
  interviewFeedback?: InterviewFeedback;
  earlierInterviewRounds?: EarlierRound[];
  finalInterviewThoughts?: VotingInterviewThought[];
};

/**
 * Voting evidence for exactly one round (the session's round), shared by live and Demo.
 * - The score and the feedback section use the current round only; an application-review
 *   round, or an interview round without submissions, has no score ("none", never 0).
 * - Earlier rounds (lower round order) are separate labelled groups, never averaged in.
 * - Later rounds are not shown in this round's room.
 * `allowed` must already be the viewer's authorized identified interview rounds.
 */
export function roundScopedEvidence(input: {
  current: OrderedRound & { interview: boolean };
  allowed: readonly OrderedRound[]; reviews: readonly Review[];
  summaries: readonly { roundId: string; interviewerId: string; text: string }[];
  kitRecords: readonly KitRecord[]; pendingMemberIds: readonly string[];
  score: boolean; thoughts: boolean; peerScores: boolean;
}): RoundScopedEvidence {
  const { current } = input;
  if (!input.score && !input.thoughts) return {};
  const authorized = input.allowed.find(r => r.id === current.id);
  const own = authorized ? submittedScoreSummary(input.reviews.filter(r => r.roundId === current.id), []) : null;
  const status: CurrentRoundScore["status"] = !current.interview ? "none" : !authorized ? "withheld" : own?.average != null ? "scored" : "none";
  const average = status === "scored" ? own!.average : null, submitted = status === "scored" ? own!.submitted : 0;
  const earlier = input.allowed.filter(r => r.id !== current.id && r.order < current.order);
  const result: RoundScopedEvidence = {};
  if (input.score) result.interviewScore = {
    average, submitted, rounds: status === "scored" ? 1 : 0, scale: "1–10", withheld: status === "withheld",
    byRound: status === "scored" ? [{ roundId: current.id, roundName: current.name, average: average!, submitted }] : [],
    scope: "Submitted 1–10 interview evaluations in this round only; earlier rounds are listed separately",
    current: { roundId: current.id, roundName: current.name, status, average, submitted },
  };
  if (input.thoughts) {
    result.finalInterviewThoughts = [];
    const feedback = authorized ? buildInterviewFeedback({ allowed: [authorized], requestedRoundId: current.id, reviews: input.reviews, summaries: input.summaries,
      pendingMemberIds: input.pendingMemberIds, includeScores: input.score && input.peerScores }) : null;
    if (feedback) result.interviewFeedback = feedback;
  }
  result.earlierInterviewRounds = earlierRoundEvidence({ rounds: earlier, reviews: input.reviews, summaries: input.thoughts ? input.summaries : [], kitRecords: input.kitRecords,
    includeScores: input.score && input.peerScores, includeAverage: input.score, includeSummaries: input.thoughts });
  return result;
}
