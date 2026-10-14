import type { DemoState } from "./seed";
import { sampleInterviewKit, emptyInterviewDraft } from "@/lib/interview-kits";
import { snapshotSubmittedQuestions } from "@/lib/interview-review-summary";
const id = (n: number) => `de000000-0000-4000-8000-${String(9900000 + n).padStart(12,"0")}`;
export function ensureInterviewImprovements(s: DemoState) {
  const f = s.interviewFoundation;
  f.assignmentNotices ??= [];
  if (f.improvementsSeeded) return;
  const seededAt = new Date(`${s.anchor}T12:00:00Z`);
  const club = s.clubs[0], members = s.memberships.filter(m => m.clubId === club.id), owner = members.find(m => m.isOwner), peer = members.find(m => !m.isOwner);
  const first = club.rounds.find(r => r.name === "Round 1"), interview = club.rounds.find(r => r.name === "Interview");
  if (!owner || !peer || !first || !interview) return;
  let second = club.rounds.find(r => r.name === "Round 2");
  if (!second) { const order = interview.order + 1; for (const r of club.rounds) if (r.order >= order) r.order++; second = { ...structuredClone(interview), id: id(1), name: "Round 2", order, configuration: { instructions: "Fictional second-round interview", duration: 35 } }; club.rounds.push(second); }
  const base = s.applications.find(a => a.clubId === club.id)!;
  const free = s.students.filter(u => !members.some(m => m.userId === u.id) && !s.applications.some(a => a.clubId === club.id && a.studentId === u.id)).slice(-3);
  if (free.length < 3) return;
  free.forEach((student, index) => {
    const appId = id(10 + index); if (s.applications.some(a => a.id === appId)) return;
    const round = index === 0 ? second! : interview;
    const app: DemoState["applications"][number] = { ...structuredClone(base), id: appId, studentId: student.id, roundId: round.id, status: "INTERVIEWING" as const, anonymousReviewText: null, answers: [], evaluations: [], submittedAt: seededAt };
    s.applications.push(app);
    for (const m of [owner,peer]) f.assignments.push({ applicationId: appId, roundId: round.id, memberId: m.id, revokedAt: null });
    const reviewRound = index === 0 ? first : round;
    for (const [reviewerIndex, m] of [owner,peer].entries()) {
      if (index === 2 && reviewerIndex === 1) continue;
      const score = reviewerIndex === 0 ? 8 : 7.5, at = new Date(seededAt.getTime() - 86400000);
      const draft = { ...structuredClone(emptyInterviewDraft), score, postInterview: true, additionalNotes: "Fictional submitted review: weighed evidence and discussed tradeoffs.", applicantQuestions: "Asked about the weekly learning schedule.", completedQuestionIds: [sampleInterviewKit()[0].id], questionNotes: [{ questionId: sampleInterviewKit()[0].id, notes: "Fictional finalized note: explained what changed the original hypothesis." }] };
      const record = { id: id(20+index*2+reviewerIndex), applicationId: appId, interviewerId: m.id, roundId: reviewRound.id, clubId: club.id, anonymousReview: false, revision: 1, questions: sampleInterviewKit(), draft, completedAt: at.toISOString(), submittedQuestions: snapshotSubmittedQuestions(sampleInterviewKit(),draft) };
      s.interviews.push(record);
      app.evaluations.push({ id: id(30+index*2+reviewerIndex), applicationId: appId, interviewerId: m.id, roundId: reviewRound.id, round: reviewRound.name, score, notes: draft.additionalNotes, applicantQuestions: draft.applicantQuestions, submittedAt: at, createdAt: at });
    }
    f.assignmentNotices!.push({ id: id(40+index), memberId: owner.id, applicationId: appId, roundId: round.id, key: `fixture:${appId}`, title: "Interview assignment", createdAt: seededAt.toISOString() });
  });
  f.improvementsSeeded = true;
}
export function demoAssignmentNotice(s: DemoState, a: DemoState["interviewFoundation"]["assignments"][number], cancelled: boolean) {
  const f = s.interviewFoundation; f.assignmentNotices ??= [];
  const key = `${a.applicationId}:${a.roundId}:${a.memberId}:${a.bookingId || a.notificationVersion || 0}:${cancelled}`;
  if (f.assignmentNotices.some(n => n.key === key)) return;
  f.assignmentNotices.push({ id: crypto.randomUUID(), memberId: a.memberId, applicationId: a.applicationId, roundId: a.roundId, key, title: cancelled ? "Interview assignment changed" : "Interview assignment", createdAt: new Date().toISOString() });
}
