import { anonymousApplicantLabel } from "@/lib/anonymous-review";
import { demoStore, demoMember } from "./store";
import { annotationContentSchema, interviewCapabilities, interviewOfficesSchema, interviewScopeSchema, interviewScoreSchema, type InterviewScope } from "@/lib/interview-access";
import { emptyInterviewDraft, interviewDraftSchema, kitSchema, validateQuestionNotes, validateAdditionalQuestionSnapshots } from "@/lib/interview-kits";
import { z } from "zod";
import { anchorMatchesText } from "@/lib/resume-anchors";
import { demoResumeText } from "./resume-fixture";

type Content = z.infer<typeof annotationContentSchema>;
export type DemoInterviewFoundation = {
  collaboration?: import("./interview-collaboration").DemoCollaboration;
  assignments: { applicationId: string; roundId: string; memberId: string; revokedAt: string | null; bookingManaged?: boolean; bookingId?: string | null }[];
  documents: { id: string; applicationId: string; roundId: string; source: string; createdAt: string }[];
  annotations: (Content & { id: string; documentId: string; authorId: string; revision: number; deletedAt: string | null })[];
  history: { annotationId: string; revision: number; actorId: string; content: Content }[];
  audit: { action: string; targetId: string; actorId: string }[];
};
function actor(clubId: string) {
  const s = demoStore.get(), member = demoMember();
  if (s.perspective.role !== "leader" || member.clubId !== clubId || member.status !== "ACTIVE") throw new Error("Interview access unavailable.");
  return { s, member, caps: interviewCapabilities(member) };
}
function access(input: InterviewScope, mode: "panel" | "resume" | "closing" | "closingReview" = "panel") {
  const { s, member, caps } = actor(input.clubId);
  const app = s.applications.find(a => a.id === input.applicationId && a.clubId === input.clubId && a.status !== "DRAFTING");
  const round = s.clubs.find(c => c.id === input.clubId)?.rounds.find(r => r.id === input.roundId);
  if (!app || !round || app.studentId === member.userId || ((round.anonymousReview || s.clubs.find(c => c.id === input.clubId)!.rounds.find(r => r.id === app.roundId)?.anonymousReview) && !(mode === "closingReview" && caps.readClosing))) throw new Error("Identified interview unavailable.");
  const panel = caps.participate && s.interviewFoundation.assignments.some(a => a.applicationId === app.id && a.roundId === round.id && a.memberId === member.id && !a.revokedAt);
  if (!panel && !(mode === "resume" && caps.moderateResume) && !((mode === "closing" || mode === "closingReview") && caps.readClosing)) throw new Error("Current panel assignment required.");
  return { s, member, caps, app, round };
}
export function getInterviewKit(clubId: string, roundId: string) {
  const { s, member, caps } = actor(clubId);
  const round = s.clubs.find(c => c.id === clubId)?.rounds.find(r => r.id === roundId);
  if (!round || (!caps.editKit && !(caps.participate && s.interviewFoundation.assignments.some(a => a.roundId === roundId && a.memberId === member.id && !a.revokedAt)))) throw new Error("Question bank access denied.");
  return { questions: structuredClone(round.interviewKit), version: round.kitVersion };
}
export function getInterviewWorkspace(clubId: string) {
  const { s, member, caps } = actor(clubId);
  if (!caps.participate) throw new Error("Identified interview access required.");
  const club = s.clubs.find(c => c.id === clubId)!;
  const applications = s.applications.filter(a => a.clubId === clubId && a.status !== "DRAFTING" && a.studentId !== member.userId && !club.rounds.find(r => r.id === a.roundId)?.anonymousReview).map(a => {
    const p = s.students.find(p => p.id === a.studentId)?.profile;
    return { id: a.id, roundId: a.roundId, name: p ? `${p.firstName} ${p.lastName}` : "Profile not provided", assignedRoundIds: s.interviewFoundation.assignments.filter(x => x.applicationId === a.id && x.memberId === member.id && !x.revokedAt && !club.rounds.find(r => r.id === x.roundId)?.anonymousReview).map(x => x.roundId), completedRoundIds: s.interviews.filter(r => r.applicationId === a.id && r.interviewerId === member.id && r.completedAt && !r.anonymousReview).map(r => r.roundId) };
  }).filter(a => a.assignedRoundIds.length);
  return { applications, rounds: club.rounds.filter(r => !r.anonymousReview && applications.some(a => a.assignedRoundIds.includes(r.id))).map(r => ({ id: r.id, name: r.name, archived: false })) };
}
export function saveInterviewKit(clubId: string, roundId: string, version: number, questions: unknown) {
  if (!actor(clubId).caps.editKit) throw new Error("Explicit leadership office required.");
  return demoStore.mutate(s => { const round = s.clubs.find(c => c.id === clubId)?.rounds.find(r => r.id === roundId); if (!round || round.kitVersion !== version) throw new Error("Kit changed."); round.interviewKit = kitSchema.parse(questions); round.kitVersion++; return { questions: round.interviewKit, version: round.kitVersion }; });
}
export function openInterviewSession(input: InterviewScope) {
  const { app, round, member } = access(input);
  return demoStore.mutate(s => {
    let record = s.interviews.find(r => r.applicationId === app.id && r.roundId === round.id && r.interviewerId === member.id);
    if (!record) { if (app.roundId !== round.id) throw new Error("Applicant round changed."); record = { id: crypto.randomUUID(), ...input, interviewerId: member.id, anonymousReview: false, revision: 0, questions: structuredClone(round.interviewKit), draft: structuredClone(emptyInterviewDraft), completedAt: null }; s.interviews.push(record); }
    if (record.anonymousReview || (!record.completedAt && app.roundId !== round.id)) throw new Error("Interview unavailable.");
    return structuredClone(record);
  });
}
export function saveInterviewSession(input: InterviewScope & { revision: number; draft: unknown; complete?: boolean }) {
  const { member, app, round } = access(input); const draft = interviewDraftSchema.parse(input.draft);
  return demoStore.mutate(s => {
    const record = s.interviews.find(r => r.applicationId === app.id && r.roundId === round.id && r.interviewerId === member.id);
    if (!record || record.anonymousReview) throw new Error("Interview unavailable.");
    const target = s.applications.find(a => a.id === app.id)!;
    if (record.completedAt) {
      if (!input.complete || input.revision !== record.revision - 1 || JSON.stringify(interviewDraftSchema.parse(record.draft)) !== JSON.stringify(draft)) throw new Error("Interview already completed.");
      return { session: structuredClone(record), evaluation: target.evaluations.find(e => e.interviewerId === member.id && e.roundId === round.id) || null };
    }
    if (app.roundId !== round.id || record.revision !== input.revision) throw new Error("Interview changed. Reload before saving.");
    validateQuestionNotes(record.questions, draft);
    if (draft.score !== null) interviewScoreSchema.parse(draft.score);
    const shared = s.interviewFoundation.collaboration?.rooms.find(r => r.scope.clubId === input.clubId && r.scope.applicationId === app.id && r.scope.roundId === round.id);
    validateAdditionalQuestionSnapshots(record.draft, draft, [...kitSchema.parse(round.interviewKit), ...(shared?.questions || [])]);
    let evaluation = null;
    if (input.complete) {
      const score = interviewScoreSchema.parse(draft.score);
      const old = target.evaluations.find(e => e.interviewerId === member.id && e.roundId === round.id);
      if (old?.submittedAt) throw new Error("Submitted evaluation is immutable.");
      if (target.evaluations.some(e => e.interviewerId === member.id && !e.roundId)) throw new Error("Historical evaluation requires reconciliation.");
      evaluation = { id: old?.id || crypto.randomUUID(), applicationId: app.id, interviewerId: member.id, roundId: round.id, round: round.name, score, notes: draft.additionalNotes ?? draft.overallReview, applicantQuestions: draft.applicantQuestions || "", submittedAt: new Date(), createdAt: old?.createdAt || new Date() };
      target.evaluations = [...target.evaluations.filter(e => e.id !== evaluation!.id), evaluation];
    }
    record.draft = draft; record.revision++; record.completedAt = input.complete ? new Date().toISOString() : null;
    return { session: structuredClone(record), evaluation };
  });
}
export function submitEvaluation(input: { clubId: string; applicationId: string; roundId?: string; roundName: string; score: number; notes?: string }) {
  const app = actor(input.clubId).s.applications.find(a => a.id === input.applicationId && a.clubId === input.clubId);
  if (!app) throw new Error("Application unavailable.");
  const scope = { ...input, roundId: input.roundId || app.roundId }; const { round } = access(scope);
  if (!input.roundId && round.name !== input.roundName) throw new Error("Provide stable round ID.");
  const record = openInterviewSession(scope);
  if (record.completedAt) throw new Error("Submitted evaluation is immutable.");
  return { success: true, evaluation: saveInterviewSession({ ...scope, revision: record.revision, draft: { ...record.draft, score: input.score, additionalNotes: input.notes ?? record.draft.overallReview }, complete: true }).evaluation! };
}
export function getSubmittedInterviewReviews(clubId: string) {
  demoStore.refresh();
  const { s, caps } = actor(clubId);
  if (!caps.readClosing) throw new Error("Explicit leadership review access required.");
  return s.interviews.filter(r => {
    if (!r.completedAt || r.clubId !== clubId) return false;
    try { access({ clubId, applicationId: r.applicationId, roundId: r.roundId }, "closingReview"); return true; } catch { return false; }
  }).sort((a,b) => (+new Date(b.completedAt!) - +new Date(a.completedAt!)) || b.id.localeCompare(a.id)).slice(0,100).map(r => {
    const app = s.applications.find(a => a.id === r.applicationId)!, profile = s.students.find(p => p.id === app.studentId)?.profile;
    const club = s.clubs.find(c => c.id === clubId)!; const round = club.rounds.find(round => round.id === r.roundId)!; const anonymous = !!(r.anonymousReview || round.anonymousReview || club.rounds.find(round => round.id === app.roundId)?.anonymousReview); return { id: r.id, applicationId: r.applicationId, roundId: r.roundId, interviewerId: r.interviewerId, anonymous, roundName: anonymous ? "Interview review" : round.name, applicantName: anonymous ? anonymousApplicantLabel(app.id) : profile ? `${profile.firstName} ${profile.lastName}` : "Profile not provided" };
  });
}
export function getSubmittedInterviewReview(input: InterviewScope & { interviewerId: string }) {
  demoStore.refresh();
  const { s, member, caps } = access(input, "closingReview");
  if (input.interviewerId !== member.id && !caps.readClosing) throw new Error("Leadership required.");
  const r = s.interviews.find(r => r.applicationId === input.applicationId && r.roundId === input.roundId && r.interviewerId === input.interviewerId && r.completedAt);
  if (!r) throw new Error("Submitted review unavailable.");
  const e = s.applications.find(a => a.id === input.applicationId)!.evaluations.find(e => e.roundId === input.roundId && e.interviewerId === input.interviewerId);
  const club=s.clubs.find(c=>c.id===input.clubId)!;const anonymous=!!(r.anonymousReview||club.rounds.find(round=>round.id===input.roundId)?.anonymousReview||club.rounds.find(round=>round.id===s.applications.find(a=>a.id===input.applicationId)!.roundId)?.anonymousReview);if(anonymous&&!caps.readClosing)throw Error("Leadership required.");return { id: r.id, interviewerId: r.interviewerId, roundId: r.roundId, anonymous,textUnavailable:anonymous,submittedAt: anonymous?null:r.completedAt, score: e?.score ?? r.draft.score, applicantQuestions: anonymous ? "" : e?.applicantQuestions ?? r.draft.applicantQuestions ?? "", additionalNotes: anonymous ? "" : e?.notes ?? r.draft.additionalNotes ?? r.draft.overallReview, readOnly: true };
}
export function getPreviousInterviewScores(input: InterviewScope) {
  const { s, member } = access(input);
  return s.interviews.filter(r => {
    if (r.interviewerId !== member.id || r.clubId !== input.clubId || r.roundId !== input.roundId || r.applicationId === input.applicationId || !r.completedAt || r.anonymousReview) return false;
    if (!s.applications.find(a => a.id === r.applicationId)?.evaluations.some(e => e.interviewerId === member.id && e.roundId === input.roundId)) return false;
    try { access({ ...input, applicationId: r.applicationId }); return true; } catch { return false; }
  }).sort((a,b) => (+new Date(b.completedAt!) - +new Date(a.completedAt!)) || b.id.localeCompare(a.id)).slice(0,5).map(r => {
    const app = s.applications.find(a => a.id === r.applicationId)!, p = s.students.find(p => p.id === app.studentId)!.profile;
    const e = app.evaluations.find(e => e.roundId === r.roundId && e.interviewerId === member.id);
    return { id: r.id, name: `${p.firstName} ${p.lastName}`, score: e?.score ?? r.draft.score };
  });
}
export function setMemberInterviewOffices(input: unknown) {
  const d = z.object({ clubId: z.string(), memberId: z.string(), offices: interviewOfficesSchema }).parse(input); const { member, caps } = actor(d.clubId);
  if (!caps.manageGrants) throw new Error("Owner required.");
  return demoStore.mutate(s => { const target = s.memberships.find(m => m.id === d.memberId && m.clubId === d.clubId && m.status === "ACTIVE"); if (!target) throw new Error("Active member required."); target.interviewOffices = d.offices; s.interviewFoundation.audit.push({ action: "interview.offices.change", targetId: target.id, actorId: member.userId }); return { memberId: target.id, offices: d.offices }; });
}
export function setInterviewPanelAssignment(input: unknown) {
  const d = interviewScopeSchema.extend({ memberId: z.string(), assigned: z.boolean() }).parse(input); const { member, caps } = actor(d.clubId);
  if (!caps.manageGrants) throw new Error("Owner required.");
  return demoStore.mutate(s => {
    const target = s.memberships.find(m => m.id === d.memberId && m.clubId === d.clubId), app = s.applications.find(a => a.id === d.applicationId && a.clubId === d.clubId && a.status !== "DRAFTING"), round = s.clubs.find(c => c.id === d.clubId)?.rounds.find(r => r.id === d.roundId);
    if (!target || !app || !round || app.studentId === target.userId || (d.assigned && (!interviewCapabilities(target).participate || app.roundId !== round.id || round.anonymousReview))) throw new Error("Panel scope unavailable.");
    const a = s.interviewFoundation.assignments.find(a => a.applicationId === app.id && a.roundId === round.id && a.memberId === target.id);
    if (a) { a.revokedAt = d.assigned ? null : new Date().toISOString(); a.bookingManaged=false;a.bookingId=null; }
    else if (d.assigned) s.interviewFoundation.assignments.push({ applicationId: app.id, roundId: round.id, memberId: target.id, revokedAt: null });
    s.interviewFoundation.audit.push({ action: "interview.panel.change", targetId: target.id, actorId: member.userId }); return { ...d };
  });
}
export function pinInterviewResume(input: InterviewScope) {
  const { app } = access(input, "resume");
  return demoStore.mutate(s => { const f = s.interviewFoundation; let d = f.documents.find(d => d.applicationId === input.applicationId && d.roundId === input.roundId); if (!d) { if(app.roundId !== input.roundId) throw new Error("Past round snapshot unavailable."); d = { id: crypto.randomUUID(), applicationId: app.id, roundId: input.roundId, source: "/demo/sample-resume.pdf", createdAt: new Date().toISOString() }; f.documents.push(d); } return structuredClone(d); });
}
function documentAccess(input: InterviewScope & { documentId: string }) {
  const a = access(input, "resume"), d = a.s.interviewFoundation.documents.find(d => d.id === input.documentId && d.applicationId === input.applicationId && d.roundId === input.roundId);
  if (!d) throw new Error("Document unavailable."); return { ...a, document: d };
}
export function getInterviewApplicantPanel(input: InterviewScope) {
  const { s, app } = access(input); const p = s.students.find(p => p.id === app.studentId)!.profile;
  return { profile: { firstName: p.firstName, lastName: p.lastName, headshotUrl: p.headshotUrl, scholarStatus: p.scholarStatus }, document: s.interviewFoundation.documents.find(d => d.applicationId === app.id && d.roundId === input.roundId) || null };
}
export function getInterviewResumeModerationQueue(clubId: string) {
  demoStore.refresh(); const { s, member, caps } = actor(clubId);
  if (!caps.moderateResume) throw new Error("President or vice-president moderation access required.");
  return s.interviewFoundation.documents.flatMap(document => {
    const app = s.applications.find(a => a.id === document.applicationId && a.clubId === clubId && a.studentId !== member.userId && a.status !== "DRAFTING");
    const round = s.clubs.find(c => c.id === clubId)?.rounds.find(r => r.id === document.roundId);
    const current = s.clubs.find(c => c.id === clubId)?.rounds.find(r => r.id === app?.roundId);
    if (!app || !round || !current || round.anonymousReview || current.anonymousReview) return [];
    const profile = s.students.find(p => p.id === app.studentId)?.profile;
    return [{ documentId: document.id, clubId, applicationId: app.id, roundId: round.id, roundName: round.name, applicantName: profile ? `${profile.firstName} ${profile.lastName}` : "Profile not provided" }];
  }).reverse().slice(0, 100);
}
export function getInterviewResumeAnnotations(input: InterviewScope & { documentId: string }) {
  demoStore.refresh();
  const { s, document, member, caps } = documentAccess(input);
  return { document, annotations: s.interviewFoundation.annotations.filter(a => a.documentId === document.id && !a.deletedAt).map(a => { const m = s.memberships.find(m => m.id === a.authorId)!, p = s.students.find(p => p.id === m.userId)!.profile; return { ...a, authorName: `${p.firstName} ${p.lastName}`, canEdit: a.authorId === member.id || caps.moderateResume }; }) };
}
async function annotationMutation<T>(run: () => T): Promise<T> {
  const fresh = async () => { demoStore.refresh(); return run(); };
  // Serialize only local demo annotation writes across tabs; live writes use database revisions.
  return typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("outclass-demo-resume-annotations", fresh) : fresh();
}
export async function saveInterviewResumeAnnotation(input: unknown) {
  return annotationMutation(() => {
  const d = interviewScopeSchema.extend({ documentId: z.string(), id: z.string(), revision: z.number().int().min(0).optional(), content: annotationContentSchema }).parse(input);
  const { member, caps, document } = documentAccess(d);
  if (d.content.anchor && (document.source !== "/demo/sample-resume.pdf" || !anchorMatchesText(d.content.anchor, demoResumeText, 1))) throw new Error("Highlight does not match the saved demo document.");
  return demoStore.mutate(s => {
    const f = s.interviewFoundation, old = f.annotations.find(a => a.id === d.id);
    if (old && (old.documentId !== d.documentId || old.deletedAt || (old.authorId !== member.id && !caps.moderateResume))) throw new Error("Annotation unavailable.");
    if (old) {
      if (d.revision === undefined && old.authorId === member.id && old.revision === 0 && JSON.stringify(annotationContentSchema.parse({ kind: old.kind, comment: old.comment, anchor: old.anchor })) === JSON.stringify(d.content)) return { id: old.id, revision: old.revision };
      if (old.revision !== d.revision) throw new Error("Annotation changed.");
      f.history.push({ annotationId: old.id, actorId: member.userId, revision: old.revision, content: { kind: old.kind, comment: old.comment, anchor: old.anchor } }); Object.assign(old, d.content, { revision: old.revision + 1 });
    } else { if (d.revision !== undefined) throw new Error("Annotation unavailable."); f.annotations.push({ id: d.id, documentId: d.documentId, authorId: member.id, revision: 0, deletedAt: null, ...d.content }); }
    f.audit.push({ action: "interview.annotation.save", targetId: d.id, actorId: member.userId }); return { id: d.id, revision: old?.revision || 0 };
  });
  });
}
export async function deleteInterviewResumeAnnotation(input: unknown) {
  return annotationMutation(() => {
  const d = interviewScopeSchema.extend({ documentId: z.string(), id: z.string(), revision: z.number().int().min(0) }).parse(input); const { member, caps } = documentAccess(d);
  return demoStore.mutate(s => { const a = s.interviewFoundation.annotations.find(a => a.id === d.id && a.documentId === d.documentId); if (!a || a.deletedAt || (a.authorId !== member.id && !caps.moderateResume)) throw new Error("Annotation unavailable."); if(a.revision !== d.revision) throw new Error("Annotation changed."); s.interviewFoundation.history.push({ annotationId: a.id, actorId: member.userId, revision: a.revision, content: { kind: a.kind, anchor: a.anchor, comment: a.comment } }); a.deletedAt = new Date().toISOString(); a.revision++; s.interviewFoundation.audit.push({ action: "interview.annotation.delete", targetId: a.id, actorId: member.userId }); return { id: a.id, deleted: true }; });
  });
}
export function getInterviewAnnotationHistory(input: unknown) {
  const d = interviewScopeSchema.extend({ documentId: z.string(), id: z.string() }).parse(input); const { s, member, caps } = documentAccess(d);
  const a = s.interviewFoundation.annotations.find(a => a.id === d.id && a.documentId === d.documentId); if (!a || (a.authorId !== member.id && !caps.moderateResume)) throw new Error("History unavailable."); return s.interviewFoundation.history.filter(h => h.annotationId === a.id);
}
