import { z } from "zod";
import { interviewCapabilities, type InterviewAccess } from "@/lib/interview-access";
import { hasPermission } from "@/lib/permissions";
export type InterviewSetupRound = { id: string; name: string; canReadKit: boolean };
export type InterviewSetupRounds = { status: "ready" | "denied"; rounds: InterviewSetupRound[] };
/** Setup metadata is independent of private bank access and applicant assignments. */
export function canDiscoverInterviewSetup(member: InterviewAccess) {
  return interviewCapabilities(member).editKit || hasPermission(member, "interviews.manage") || hasPermission(member, "recruitment.manage");
}
export function interviewSetupHref(clubId: string, roundId?: string, tab = "kits") {
  const params = new URLSearchParams({ section: "settings", setting: "interviews", interviewTab: tab });
  if (roundId) params.set("roundId", roundId);
  return `/club/${encodeURIComponent(clubId)}/workspace?${params}`;
}
const id=z.string().uuid();
export const roomPanelChangeSchema=z.object({clubId:id,roomId:id,revision:z.number().int().nonnegative(),panelMemberIds:z.array(id).max(10)}).strict();
export const roomPanelApprovalSchema=roomPanelChangeSchema.extend({confirm:z.literal(true)});
