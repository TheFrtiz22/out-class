import { submittedScoreSummary } from "@/lib/interview-review-summary";

export type VotingInterviewRound = { id: string; name: string };
export type VotingInterviewScore = {
  average: number | null; submitted: number; rounds: number;
  scale: "1–10"; scope: string; withheld: boolean;
  byRound: { roundId: string; roundName: string; average: number; submitted: number }[];
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
