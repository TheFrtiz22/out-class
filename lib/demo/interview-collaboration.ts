import { demoStore, demoMember } from "./store";
import { getInterviewWorkspace, openInterviewSession, demoInterviewTiming } from "./interview-foundation";
import { nextInterviewApplicant } from "@/lib/interview-queue";
import type { InterviewScope } from "@/lib/interview-access";
import type { CollaborationView } from "@/lib/interview-collaboration";
import type { KitQuestion } from "@/lib/interview-kits";
import { applyTimerCommand, freshTimerState, presentTimer, type SharedTimerState, type TimerCommand, type TimerControlResult } from "@/lib/interview-shared-timer";
export type DemoCollaboration = {
  rooms: { id: string; scope: InterviewScope; questions: KitQuestion[]; revision: number; selection: CollaborationView["selection"]; timer?: SharedTimerState & { revision: number; lastRequestId: string } }[];
  moves: { id: string; scope: InterviewScope; destination: InterviewScope; invited: boolean; confirmed: boolean }[];
  invites: { id: string; source: InterviewScope; destination: InterviewScope; expires: number; dismissed: boolean }[];
};
type Input = InterviewScope & { clientId: string };
function withRoom<T>(scope: InterviewScope, work: (room: DemoCollaboration["rooms"][number], own: ReturnType<typeof openInterviewSession>) => T): T {
  demoStore.refresh();
  return demoStore.batch(() => {
    const own = openInterviewSession(scope); // Always recheck current Demo authorization.
    const existing = demoStore.get().interviewFoundation.collaboration?.rooms.find(r => r.scope.applicationId === scope.applicationId && r.scope.roundId === scope.roundId && r.scope.clubId === scope.clubId);
    const r = existing || demoStore.mutate(s => {
      const c = s.interviewFoundation.collaboration ??= { rooms: [], moves: [], invites: [] };
      const created = { id: crypto.randomUUID(), scope, questions: structuredClone(own.questions), revision: 0, selection: null };
      c.rooms.push(created); return created;
    });
    return work(structuredClone(r), own);
  });
}
function room(scope: InterviewScope) { return withRoom(scope, value => value); }
export function getInterviewCollaboration(input: Input): CollaborationView {
  return withRoom(input, r => {
  const s = demoStore.get(), member = demoMember();
  const invite = s.interviewFoundation.collaboration!.invites.find(i => i.source.applicationId === input.applicationId && i.source.roundId === input.roundId && !i.dismissed && i.expires > Date.now());
  const candidate = invite && getInterviewWorkspace(input.clubId).applications.find(a => a.id === invite.destination.applicationId && a.roundId === input.roundId && !a.completedRoundIds.includes(input.roundId));
  return { sessionId: r.id, revision: r.revision, selection: r.selection, participants: [{ id: member.id, name: "You" }, { id: "simulated-alex", name: "Alex · simulated" }], invitation: invite && candidate ? { id: invite.id, sender: "Alex · simulated", candidate: candidate.name } : null, simulated: true, timing: demoInterviewTiming(input), timer: demoTimer(r, demoInterviewTiming(input)) };
  });
}
export function selectSharedInterviewQuestion(input: Input & { questionId: string }) {
  return withRoom(input, (r, own) => {
  if (own.completedAt || own.draft.postInterview) throw Error("Only active interviews can select shared questions.");
  const added = own.draft.additionalQuestions.find(q => q.id === input.questionId);
  const kitQuestion = demoStore.get().clubs.find(c => c.id === input.clubId)?.rounds.find(x => x.id === input.roundId)?.interviewKit.find(q => q.id === input.questionId);
  const question = r.questions.find(q => q.id === input.questionId) || (added?.bankQuestion ? { id: added.id, prompt: added.question, guidance: added.bankQuestion.guidance } : kitQuestion) || (added ? { id: added.id, prompt: added.question, guidance: "" } : undefined) || getInterviewWorkspace(input.clubId) && demoStore.get().clubs.find(c => c.id === input.clubId)!.rounds.find(r => r.id === input.roundId)!.interviewKit.find(q => q.id === input.questionId);
  if (!question) throw Error("Select a bank question.");
  return demoStore.mutate(s => { const target = s.interviewFoundation.collaboration!.rooms.find(x => x.id === r.id)!; if (!target.questions.some(q => q.id === question.id)) target.questions.push(question); target.revision++; target.selection = { question, by: "You", memberId: demoMember().id }; return { revision: target.revision, question }; });
  });
}
function demoTimer(r: DemoCollaboration["rooms"][number], timing: ReturnType<typeof demoInterviewTiming>) {
  return presentTimer(r.timer ? { ...r.timer, startedAt: r.timer.startedAt === null ? null : new Date(r.timer.startedAt), pausedAt: r.timer.pausedAt === null ? null : new Date(r.timer.pausedAt) } : null, timing, Date.now());
}
/** Demo counterpart of controlInterviewTimer: same transitions and revision check, demo store only. */
export function controlInterviewTimer(input: InterviewScope & { revision: number; requestId: string; command: TimerCommand }): TimerControlResult {
  return withRoom(input, r => {
    const timing = demoInterviewTiming(input), now = Date.now();
    if (!timing) return { status: "conflict" as const, timer: demoTimer(r, timing) };
    if (r.timer?.lastRequestId === input.requestId) return { status: "ok" as const, timer: demoTimer(r, timing) };
    if ((r.timer?.revision ?? 0) !== input.revision) return { status: "conflict" as const, timer: demoTimer(r, timing) };
    const next = applyTimerCommand(r.timer ?? freshTimerState(timing), input.command, now, timing);
    if (!next) return { status: "conflict" as const, timer: demoTimer(r, timing) };
    const timer = { durationMs: next.durationMs, contextKey: next.contextKey, startedAt: next.startedAt, pausedAt: next.pausedAt, pausedMs: next.pausedMs, revision: (r.timer?.revision ?? 0) + 1, lastRequestId: input.requestId };
    demoStore.mutate(s => { s.interviewFoundation.collaboration!.rooms.find(x => x.id === r.id)!.timer = timer; });
    return { status: "ok" as const, timer: demoTimer({ ...r, timer }, timing) };
  });
}
export function simulateDemoInterviewSelection(input: InterviewScope) {
  const r = room(input);
  const q = r.questions[(r.questions.findIndex(q => q.id === r.selection?.question.id) + 1) % r.questions.length];
  if (!q) return;
  demoStore.mutate(s => { const target = s.interviewFoundation.collaboration!.rooms.find(x => x.id === r.id)!; target.revision++; target.selection = { question: q, by: "Alex · simulated", memberId: "simulated-alex" }; });
}
export function simulateDemoInterviewAdvance(input: InterviewScope) {
  const r = room(input), next = nextInterviewApplicant(getInterviewWorkspace(input.clubId).applications, input.roundId, input.applicationId);
  if (!next) throw Error("No sample candidates left.");
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
