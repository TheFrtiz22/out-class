import { demoStore, demoMember } from "./store";
import { getInterviewWorkspace, openInterviewSession } from "./interview-foundation";
import { nextInterviewApplicant } from "@/lib/interview-queue";
import type { InterviewScope } from "@/lib/interview-access";
import type { CollaborationView } from "@/lib/interview-collaboration";
import type { KitQuestion } from "@/lib/interview-kits";
export type DemoCollaboration = {
  rooms: { id: string; scope: InterviewScope; questions: KitQuestion[]; revision: number; selection: CollaborationView["selection"] }[];
  moves: { id: string; scope: InterviewScope; destination: InterviewScope; invited: boolean; confirmed: boolean }[];
  invites: { id: string; source: InterviewScope; destination: InterviewScope; expires: number; dismissed: boolean }[];
};
type Input = InterviewScope & { clientId: string };
function room(scope: InterviewScope) {
  demoStore.refresh();
  const own = openInterviewSession(scope); // Existing Demo authorization, no live action.
  return demoStore.mutate(s => {
    const c = s.interviewFoundation.collaboration ??= { rooms: [], moves: [], invites: [] };
    let r = c.rooms.find(r => r.scope.applicationId === scope.applicationId && r.scope.roundId === scope.roundId && r.scope.clubId === scope.clubId);
    if (!r) { r = { id: crypto.randomUUID(), scope, questions: structuredClone(own.questions), revision: 0, selection: null }; c.rooms.push(r); }
    return structuredClone(r);
  });
}
export function getInterviewCollaboration(input: Input): CollaborationView {
  const r = room(input), s = demoStore.get(), member = demoMember();
  const invite = s.interviewFoundation.collaboration!.invites.find(i => i.source.applicationId === input.applicationId && i.source.roundId === input.roundId && !i.dismissed && i.expires > Date.now());
  const candidate = invite && getInterviewWorkspace(input.clubId).applications.find(a => a.id === invite.destination.applicationId && a.roundId === input.roundId && !a.completedRoundIds.includes(input.roundId));
  return { sessionId: r.id, revision: r.revision, selection: r.selection, participants: [{ id: member.id, name: "You" }, { id: "simulated-alex", name: "Alex · simulated" }], invitation: invite && candidate ? { id: invite.id, sender: "Alex · simulated", candidate: candidate.name } : null, simulated: true };
}
export function selectSharedInterviewQuestion(input: Input & { questionId: string }) {
  const r = room(input), own = openInterviewSession(input);
  if (own.completedAt || own.draft.postInterview) throw Error("Only active interviews can select shared questions.");
  const question = r.questions.find(q => q.id === input.questionId) || getInterviewWorkspace(input.clubId) && demoStore.get().clubs.find(c => c.id === input.clubId)!.rounds.find(r => r.id === input.roundId)!.interviewKit.find(q => q.id === input.questionId);
  if (!question) throw Error("Select a bank question.");
  return demoStore.mutate(s => { const target = s.interviewFoundation.collaboration!.rooms.find(x => x.id === r.id)!; if (!target.questions.some(q => q.id === question.id)) target.questions.push(question); target.revision++; target.selection = { question, by: "You", memberId: demoMember().id }; return { revision: target.revision, question }; });
}
export function simulateDemoInterviewSelection(input: InterviewScope) {
  const r = room(input);
  const q = r.questions[(r.questions.findIndex(q => q.id === r.selection?.question.id) + 1) % r.questions.length];
  if (!q) return;
  demoStore.mutate(s => { const target = s.interviewFoundation.collaboration!.rooms.find(x => x.id === r.id)!; target.revision++; target.selection = { question: q, by: "Alex · simulated", memberId: "simulated-alex" }; });
}
export function simulateDemoInterviewAdvance(input: InterviewScope) {
  const r = room(input), next = nextInterviewApplicant(getInterviewWorkspace(input.clubId).applications, input.roundId, input.applicationId);
  if (!next) throw Error("No eligible sample candidate remains.");
  demoStore.mutate(s => { const c = s.interviewFoundation.collaboration!; c.invites = c.invites.filter(i => i.source.applicationId !== r.scope.applicationId); c.invites.push({ id: crypto.randomUUID(), source: input, destination: { ...input, applicationId: next.id }, expires: Date.now() + 600000, dismissed: false }); });
}
export function leaveInterviewCollaboration(input: Input) { void input; }
export function dismissInterviewInvitation(input: Input & { invitationId: string }) {
  room(input); demoStore.mutate(s => { const i = s.interviewFoundation.collaboration!.invites.find(i => i.id === input.invitationId && i.source.applicationId === input.applicationId); if (i) i.dismissed = true; });
}
export function prepareInterviewAdvance(input: Input & { invitationId?: string }) {
  room(input); const own = openInterviewSession(input);
  if (!own.completedAt) throw Error("Finish your current review before joining.");
  const workspace = getInterviewWorkspace(input.clubId);
  const invited = input.invitationId ? demoStore.get().interviewFoundation.collaboration!.invites.find(i => i.id === input.invitationId && i.source.applicationId === input.applicationId && !i.dismissed && i.expires > Date.now()) : null;
  if (input.invitationId && !invited) throw Error("Invitation expired.");
  const next = invited ? workspace.applications.find(a => a.id === invited.destination.applicationId && a.roundId === input.roundId && !a.completedRoundIds.includes(input.roundId)) : nextInterviewApplicant(workspace.applications, input.roundId, input.applicationId);
  if (!next) return null;
  const scope = { clubId: input.clubId, roundId: input.roundId, applicationId: next.id };
  const id = crypto.randomUUID();
  demoStore.mutate(s => s.interviewFoundation.collaboration!.moves.push({ id, scope: input, destination: scope, invited: !!invited, confirmed: false }));
  return { scope, moveId: id };
}
export function confirmInterviewAdvance(input: { moveId: string; clientId: string }) {
  demoStore.refresh(); const move = demoStore.get().interviewFoundation.collaboration?.moves.find(m => m.id === input.moveId);
  if (!move || !openInterviewSession(move.scope).completedAt || openInterviewSession(move.destination).completedAt) throw Error("Move unavailable.");
  demoStore.mutate(s => { s.interviewFoundation.collaboration!.moves.find(m => m.id === input.moveId)!.confirmed = true; });
  return { confirmed: true };
}
