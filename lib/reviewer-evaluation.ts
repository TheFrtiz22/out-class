/** Stable identity wins even when historical labels differ from current names. */
export function findReviewerEvaluation<T extends { interviewerId: string; roundId?: string | null; round: string }>(
  evaluations: readonly T[], interviewerId: string, round: { id: string; name: string } | undefined,
): T | undefined {
  if (!round) return undefined;
  return evaluations.find(e => e.interviewerId === interviewerId && e.roundId === round.id)
    ?? evaluations.find(e => e.interviewerId === interviewerId && e.roundId == null && e.round === round.name);
}
