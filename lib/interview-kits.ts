import { z } from "zod";
export const kitQuestionSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string().trim().min(1).max(3000),
  guidance: z.string().trim().max(5000).default(""),
});
export const kitSchema = z
  .array(kitQuestionSchema)
  .max(50)
  .refine(
    (items) => new Set(items.map((q) => q.id)).size === items.length,
    "Question IDs must be unique.",
  );
export type KitQuestion = z.infer<typeof kitQuestionSchema>;
export const interviewDraftSchema = z.object({
  // The screen belongs to this interviewer's versioned JSON draft, not the panel.
  postInterview: z.boolean().optional(),
  applicantQuestions: z.string().max(20000).optional(),
  additionalNotes: z.string().max(20000).optional(),
  completedQuestionIds: z.array(z.string().uuid()).max(80).optional(),
  questionNotes: z
    .array(
      z.object({ questionId: z.string().uuid(), notes: z.string().max(10000) }),
    )
    .max(50),
  additionalQuestions: z
    .array(
      z.object({
        id: z.string().uuid(),
        question: z.string().trim().min(1).max(3000),
        notes: z.string().max(10000),
        // A bank question added after the session opened keeps its own reference.
        // Off-script questions omit this metadata entirely.
        bankQuestion: z.object({ guidance: z.string().trim().max(5000) }).optional(),
      }),
    )
    .max(30),
  overallReview: z.string().max(20000),
  // Reading old records preserves historical decimals and out-of-range evidence.
  score: z.number().finite().nullable(),
});
export type InterviewDraft = z.infer<typeof interviewDraftSchema>;
export function validateAdditionalQuestionSnapshots(previous: InterviewDraft, next: InterviewDraft, bank: KitQuestion[]) {
  for (const old of previous.additionalQuestions) {
    const item = next.additionalQuestions.find(q => q.id === old.id);
    if (!item || item.question !== old.question || JSON.stringify(item.bankQuestion) !== JSON.stringify(old.bankQuestion))
      throw new Error("Existing question prompts and answer-key snapshots must be preserved.");
  }
  for (const item of next.additionalQuestions) {
    if (!item.bankQuestion || previous.additionalQuestions.some(q => q.id === item.id)) continue;
    const source = bank.find(q => q.id === item.id);
    if (!source || source.prompt !== item.question || source.guidance !== item.bankQuestion.guidance)
      throw new Error("The question bank changed. Reload the bank before adding this question.");
  }
}
export const emptyInterviewDraft: InterviewDraft = {
  questionNotes: [],
  additionalQuestions: [],
  overallReview: "",
  score: null,
};
export function validateQuestionNotes(
  questions: KitQuestion[],
  draft: InterviewDraft,
) {
  const ids = [...questions.map(q => q.id), ...draft.additionalQuestions.map(q => q.id)];
  const completed = draft.completedQuestionIds || [];
  if (new Set(ids).size !== ids.length || new Set(completed).size !== completed.length || completed.some(id => !ids.includes(id)))
    throw new Error("Invalid completed question IDs.");
  if (
    new Set(draft.questionNotes.map((n) => n.questionId)).size !==
      draft.questionNotes.length ||
    draft.questionNotes.some(
      (n) => !questions.some((q) => q.id === n.questionId),
    )
  )
    throw new Error("Notes reference a question outside this interview kit.");
  if (
    new Set(draft.additionalQuestions.map((q) => q.id)).size !==
    draft.additionalQuestions.length
  )
    throw new Error("Additional question IDs must be unique.");
}
export type InterviewSessionData = {
  instructions?: string;
  duration?: number;
  feedbackSource?: "draft" | "evaluation" | "historical-snapshot";
  id: string;
  revision: number;
  questions: KitQuestion[];
  draft: InterviewDraft;
  completedAt: string | null;
};
export function sampleInterviewKit(): KitQuestion[] {
  return [
    {
      id: "d1000000-0000-4000-8000-000000000001",
      prompt:
        "Walk us through an idea you researched and the evidence that changed your view.",
      guidance:
        "A strong response states the original hypothesis, explains how evidence was gathered, and identifies what changed the applicant’s view. Ask about an alternative explanation and the limits of the evidence. There is no single expected position; assess the reasoning rather than agreement with the interviewer.",
    },
    {
      id: "d1000000-0000-4000-8000-000000000002",
      prompt: "Describe a team disagreement and how you helped resolve it.",
      guidance:
        "Look for a specific disagreement, an effort to understand another person’s perspective, and a concrete action the applicant took. Ask what they would do differently. A thoughtful unresolved disagreement can be as useful as a successful outcome; avoid rewarding a polished story without evidence of ownership.",
    },
    {
      id: "d1000000-0000-4000-8000-000000000003",
      prompt:
        "What would you like to learn and contribute in this organization?",
      guidance: "Listen for a realistic learning goal and a concrete way to contribute. Follow up on the time or support the applicant expects to need. Assess curiosity and preparation; prior access to similar opportunities is not a prerequisite.",
    },
  ];
}
