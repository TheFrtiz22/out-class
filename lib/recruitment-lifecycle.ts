import { ActionError } from "@/lib/action-result";
import type { AppStatus } from "@prisma/client";
export const finalRecruitmentStatuses: readonly AppStatus[] = ["ACCEPTED", "REJECTED", "WAITLISTED"];
export function isInterviewRecruitmentRound(type: string) { return type === "INTERVIEW" || type === "GROUP_INTERVIEW"; }
export function assertRecruitmentTransition(previous: AppStatus, next: AppStatus, roundType: string) {
  if (previous === "DRAFTING" || next === "DRAFTING" || next === "SUBMITTED") throw new ActionError("Submitted applications only.");
  if (finalRecruitmentStatuses.includes(previous) && !finalRecruitmentStatuses.includes(next))
    throw new ActionError("Final decisions cannot be reopened. Correct the decision or use member management.");
  if (next === "INTERVIEWING" && !isInterviewRecruitmentRound(roundType)) throw new ActionError("Move to an interview round before inviting to interview.");
}
/**
 * The status an active applicant takes when moved into a round. Entering an interview round invites them to interview
 * (INTERVIEWING, which booking requires and which sends the "interview invitation" notification); leaving one returns an
 * interviewing applicant to review. Waitlisted applicants keep their status.
 */
export function statusAfterRoundMove(status: AppStatus, targetRoundType: string): AppStatus {
  if (isInterviewRecruitmentRound(targetRoundType)) return status === "SUBMITTED" || status === "IN_REVIEW" ? "INTERVIEWING" : status;
  return status === "INTERVIEWING" ? "IN_REVIEW" : status;
}
export function assertRecruitmentRoundMove(status: AppStatus) {
  if (status === "DRAFTING" || finalRecruitmentStatuses.includes(status)) throw new ActionError("Only active submitted applicants can move rounds. Final decisions cannot be reopened.");
}
