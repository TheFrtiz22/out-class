import { z } from "zod";
import type { InterviewDraft, KitQuestion } from "@/lib/interview-kits";

export const submittedQuestionsSchema = z.array(z.object({ id: z.string().uuid(), prompt: z.string().max(3000), notes: z.string().max(10000), offScript: z.boolean() }).strict()).max(80);
/** Deliberate publication at submission; never derive this from a legacy private draft on read. */
export function snapshotSubmittedQuestions(questions: KitQuestion[], draft: InterviewDraft) {
  const completed = new Set(draft.completedQuestionIds || []);
  return submittedQuestionsSchema.parse([
    ...questions.filter(q => completed.has(q.id) || draft.questionNotes.some(n => n.questionId === q.id)).map(q => ({ id: q.id, prompt: q.prompt, notes: draft.questionNotes.find(n => n.questionId === q.id)?.notes || "", offScript: false })),
    ...draft.additionalQuestions.map(q => ({ id: q.id, prompt: q.question, notes: q.notes, offScript: !q.bankQuestion })),
  ]);
}
export type RoundScoreSummary = { average: number | null; submitted: number; required: number; provisional: boolean };
export function submittedScoreSummary(reviews: { interviewerId: string; score: number; submittedAt: Date | string | null }[], assignedIds: string[]): RoundScoreSummary {
  const submitted = new Map<string, number>();
  for (const r of reviews) if (r.submittedAt && Number.isFinite(r.score) && r.score >= 1 && r.score <= 10 && !submitted.has(r.interviewerId)) submitted.set(r.interviewerId, r.score);
  const required = new Set([...assignedIds, ...submitted.keys()]).size;
  // Keep the existing contributor/validation rules, but sum in stable member
  // order so a different SQL plan cannot change floating-point rounding.
  const ordered = [...submitted].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return { average: submitted.size ? ordered.reduce((sum, [, score]) => sum + score, 0) / submitted.size : null, submitted: submitted.size, required, provisional: assignedIds.some(id => !submitted.has(id)) };
}
export function formatAverage(score: number | null) { return score === null ? "Not scored" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(score); }
