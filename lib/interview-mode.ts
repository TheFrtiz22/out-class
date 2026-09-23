export type InterviewEvaluation = {
  interviewerId: string
  round: string
  score: number
  notes: string | null
}
export function reviewerEvaluation<T extends InterviewEvaluation>(
  evaluations: T[],
  interviewerId: string,
  round: string,
) {
  return evaluations.find((item) => item.interviewerId === interviewerId && item.round === round)
}
export function interviewProgress(
  applicants: { evaluations: InterviewEvaluation[] }[],
  interviewerId: string,
  round: string,
) {
  return {
    total: applicants.length,
    completed: applicants.filter((app) => reviewerEvaluation(app.evaluations, interviewerId, round))
      .length,
  }
}
export function elapsedInterviewTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
}
