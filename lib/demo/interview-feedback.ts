import { z } from "zod";
import { demoStore, demoMember } from "./store";
import { interviewCapabilities } from "@/lib/interview-access";
import { hasPermission } from "@/lib/permissions";
import { buildInterviewFeedback, feedbackRound, type InterviewFeedback, type InterviewFeedbackResult } from "@/lib/interview-feedback";

type State = ReturnType<typeof demoStore.get>;
type Club = State["clubs"][number];
type Member = State["memberships"][number];
type App = State["applications"][number];

/** Demo mirror of authorizedInterviewRounds: identified interview rounds (current or with a
 * submitted evaluation), closing-review leaders or own-submitted panelists only. */
export function demoAuthorizedInterviewRounds(state: State, club: Club, m: Member, a: App, currentRoundId?: string) {
  const current = club.rounds.find(r => r.id === a.roundId);
  if (a.studentId === m.userId || current?.anonymousReview) return [];
  const caps = interviewCapabilities(m);
  return club.rounds.filter(r => {
    if (!["INTERVIEW", "GROUP_INTERVIEW"].includes(r.type ?? "") || r.anonymousReview || r.id !== currentRoundId && !a.evaluations.some(e => e.roundId === r.id && e.submittedAt)) return false;
    const panel = state.interviewFoundation.assignments.some(g => g.applicationId === a.id && g.roundId === r.id && g.memberId === m.id && !g.revokedAt) && caps.participate;
    const own = a.evaluations.some(e => e.roundId === r.id && e.interviewerId === m.id && e.submittedAt);
    return (caps.readClosing || panel) && ((caps.readClosing && !(a.roundId === r.id && panel)) || own);
  }).sort((x, y) => x.order - y.order || x.id.localeCompare(y.id));
}

/** Submitted evaluations in authorized rounds from club members, excluding anonymous records. */
export function demoSubmittedReviews(state: State, club: Club, a: App, allowed: readonly { id: string }[]) {
  return a.evaluations.filter(e => e.submittedAt && allowed.some(r => r.id === e.roundId) && state.memberships.some(m => m.id === e.interviewerId && m.clubId === club.id) && !state.interviews.some(r => r.applicationId === a.id && r.roundId === e.roundId && r.interviewerId === e.interviewerId && r.anonymousReview));
}

const memberName = (state: State, memberId: string) => {
  const member = state.memberships.find(m => m.id === memberId), profile = state.students.find(p => p.id === member?.userId)?.profile;
  return profile ? `${profile.firstName} ${profile.lastName}` : "Interviewer";
};

export function demoInterviewFeedback(state: State, club: Club, a: App, allowed: readonly { id: string; name: string }[], requestedRoundId: string | undefined, includeScores: boolean): InterviewFeedback | null {
  if (!allowed.length) return null;
  const reviews = demoSubmittedReviews(state, club, a, allowed);
  const summaries = state.interviews.flatMap(r => {
    const submitted = reviews.some(e => e.roundId === r.roundId && e.interviewerId === r.interviewerId);
    return r.applicationId === a.id && r.clubId === club.id && r.completedAt && !r.anonymousReview && submitted && r.draft.finalInterviewThoughts?.trim() ? [{ roundId: r.roundId, interviewerId: r.interviewerId, text: r.draft.finalInterviewThoughts }] : [];
  });
  const mapped = reviews.map(e => ({ id: e.id, roundId: e.roundId ?? null, interviewerId: e.interviewerId, score: e.score, submittedAt: e.submittedAt ?? null, interviewer: memberName(state, e.interviewerId) }));
  const round = feedbackRound(allowed, requestedRoundId, mapped);
  // Pending is a count of current, interview-capable assignees only; never names or scores.
  const pendingMemberIds = round ? state.interviewFoundation.assignments.filter(g => g.applicationId === a.id && g.roundId === round.id && !g.revokedAt && state.memberships.some(m => m.id === g.memberId && m.clubId === club.id && interviewCapabilities(m).participate)).map(g => g.memberId) : [];
  return buildInterviewFeedback({ allowed, requestedRoundId, includeScores, summaries, reviews: mapped, pendingMemberIds });
}

/** Demo implementation of actions/interview-feedback getInterviewFeedback. Never calls the server. */
export function getInterviewFeedback(input: unknown): InterviewFeedbackResult {
  const d = z.object({ clubId: z.string(), applicationId: z.string(), roundId: z.string().optional() }).strict().parse(input);
  demoStore.refresh();
  const state = demoStore.get(), club = state.clubs.find(c => c.id === d.clubId), m = demoMember();
  const a = state.applications.find(v => v.id === d.applicationId && v.clubId === d.clubId && v.status !== "DRAFTING");
  if (!club || !a || state.perspective.role !== "leader" || m.clubId !== club.id || m.status !== "ACTIVE" || !hasPermission(m, "applications.review")) return { status: "unavailable" };
  const requested = d.roundId ?? a.roundId, allowed = demoAuthorizedInterviewRounds(state, club, m, a, requested);
  // Same rule as the real action: individual peer scores need explicit leadership review access.
  return allowed.length ? { status: "ready", feedback: demoInterviewFeedback(state, club, a, allowed, requested, interviewCapabilities(m).readClosing) } : { status: "unavailable" };
}
