import { interviewCapabilities } from "@/lib/interview-access";
import { submittedScoreSummary } from "@/lib/interview-review-summary";
import type { ClubAccess } from "@/lib/permissions";

type Review = { interviewerId: string; roundId: string | null; submittedAt: Date | null; score: number };
type Assignment = { memberId: string; roundId: string; member: ClubAccess };
type Viewer = ClubAccess & { id: string; userId: string };

/** Shared by full detail and summary reads. No drafts or hidden scores escape. */
export function applicationReviewVisibility<T extends Review>(app: {
  studentId: string; roundId: string; evaluations: T[]; interviewAssignments: Assignment[];
}, membership: Viewer) {
  const caps = interviewCapabilities(membership);
  const assignments = app.interviewAssignments || [];
  const ownSubmitted = app.evaluations.some(e => e.interviewerId === membership.id && e.roundId === app.roundId && e.submittedAt);
  const assigned = assignments.some(a => a.roundId === app.roundId && a.memberId === membership.id);
  const canSeeRound = app.studentId !== membership.userId && ((caps.readClosing && !assigned) || caps.participate && assigned && ownSubmitted);
  const roundScore = canSeeRound ? submittedScoreSummary(app.evaluations.filter(e => e.roundId === app.roundId), assignments.filter(a => a.roundId === app.roundId && interviewCapabilities(a.member).participate).map(a => a.memberId)) : null;
  const evaluations = app.evaluations.filter(e => app.studentId !== membership.userId && e.submittedAt &&
    (caps.participate && e.interviewerId === membership.id && assignments.some(a => a.memberId === membership.id && a.roundId === e.roundId) || canSeeRound && (e.roundId === app.roundId || caps.readClosing)));
  return { caps, ownSubmitted, assigned, roundScore, evaluations };
}
