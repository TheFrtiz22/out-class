import type { AppStatus } from "@prisma/client";
export const finalRecruitmentStatuses: readonly AppStatus[] = ["ACCEPTED", "REJECTED", "WAITLISTED"];
export function isInterviewRecruitmentRound(type: string) { return type === "INTERVIEW" || type === "GROUP_INTERVIEW"; }
export function assertRecruitmentTransition(previous: AppStatus, next: AppStatus, roundType: string) {
  if (previous === "DRAFTING" || next === "DRAFTING" || next === "SUBMITTED") throw Error("Submitted applications only.");
  if (finalRecruitmentStatuses.includes(previous) && !finalRecruitmentStatuses.includes(next))
    throw Error("Final decisions cannot be reopened. Correct the decision or use member management.");
  if (next === "INTERVIEWING" && !isInterviewRecruitmentRound(roundType)) throw Error("Move to an interview round before inviting to interview.");
}
export function assertRecruitmentRoundMove(status: AppStatus) {
  if (status === "DRAFTING" || finalRecruitmentStatuses.includes(status)) throw Error("Only active submitted applicants can move rounds. Final decisions cannot be reopened.");
}
