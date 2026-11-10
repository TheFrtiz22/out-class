import { z } from "zod";
import { demoStore, demoMember } from "./store";
import { interviewCapabilities } from "@/lib/interview-access";
import { hasPermission } from "@/lib/permissions";
import { buildInterviewFeedback, feedbackRound, type InterviewFeedback, type InterviewFeedbackResult } from "@/lib/interview-feedback";
import { roundScopedEvidence, type RoundScopedEvidence } from "@/lib/voting-interview-evidence";

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

/** Finalized material for authorized rounds: named submitted reviews, final summaries and kit-record sources. Drafts never leave here. */
function demoFinalized(state: State, club: Club, a: App, allowed: readonly { id: string }[]) {
  const reviews = demoSubmittedReviews(state, club, a, allowed);
  const completed = state.interviews.filter(r => r.applicationId === a.id && r.clubId === club.id && r.completedAt && !r.anonymousReview && reviews.some(e => e.roundId === r.roundId && e.interviewerId === r.interviewerId));
  const summaries = completed.flatMap(r => r.draft.finalInterviewThoughts?.trim() ? [{ roundId: r.roundId, interviewerId: r.interviewerId, text: r.draft.finalInterviewThoughts }] : []);
  const kitRecords = completed.map(r => ({ roundId: r.roundId, interviewerId: r.interviewerId }));
  const mapped = reviews.map(e => ({ id: e.id, roundId: e.roundId ?? null, interviewerId: e.interviewerId, score: e.score, submittedAt: e.submittedAt ?? null, interviewer: memberName(state, e.interviewerId) }));
  return { mapped, summaries, kitRecords };
}
// Pending is a count of current, interview-capable assignees only; never names or scores.
const demoPending = (state: State, club: Club, a: App, roundId: string) => state.interviewFoundation.assignments.filter(g => g.applicationId === a.id && g.roundId === roundId && !g.revokedAt && state.memberships.some(m => m.id === g.memberId && m.clubId === club.id && interviewCapabilities(m).participate)).map(g => g.memberId);

export function demoInterviewFeedback(state: State, club: Club, a: App, allowed: readonly { id: string; name: string }[], requestedRoundId: string | undefined, includeScores: boolean): InterviewFeedback | null {
  if (!allowed.length) return null;
  const { mapped, summaries, kitRecords } = demoFinalized(state, club, a, allowed);
  const round = feedbackRound(allowed, requestedRoundId, mapped);
  const pendingMemberIds = round ? demoPending(state, club, a, round.id) : [];
  return buildInterviewFeedback({ allowed, requestedRoundId, includeScores, summaries, reviews: mapped, pendingMemberIds, kitRecords });
}

/** Demo mirror of the round-scoped voting read (votingSelectedEvidence with a current round). */
export function demoRoundScopedEvidence(state: State, club: Club, m: Member, a: App, fields: readonly string[]): RoundScopedEvidence {
  const score = fields.includes("interviewScore"), thoughts = fields.includes("finalInterviewThoughts");
  const current = club.rounds.find(r => r.id === a.roundId);
  if (!current || current.anonymousReview || (!score && !thoughts)) return {};
  const allowed = demoAuthorizedInterviewRounds(state, club, m, a, a.roundId);
  const { mapped, summaries, kitRecords } = demoFinalized(state, club, a, allowed);
  const authorizedCurrent = allowed.some(r => r.id === current.id);
  return roundScopedEvidence({ current: { id: current.id, name: current.name, order: current.order, interview: ["INTERVIEW", "GROUP_INTERVIEW"].includes(current.type ?? "") },
    allowed, reviews: mapped, summaries, kitRecords, pendingMemberIds: authorizedCurrent && thoughts ? demoPending(state, club, a, current.id) : [],
    score, thoughts, peerScores: interviewCapabilities(m).readClosing });
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
