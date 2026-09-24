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
      }),
    )
    .max(30),
  overallReview: z.string().max(20000),
  score: z.number().min(1).max(10).nullable(),
});
export type InterviewDraft = z.infer<typeof interviewDraftSchema>;
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
        "Look for a clear thesis, use of evidence, and willingness to revise assumptions.",
    },
    {
      id: "d1000000-0000-4000-8000-000000000002",
      prompt: "Describe a team disagreement and how you helped resolve it.",
      guidance:
        "Listen for specific actions, ownership, and reflection rather than a perfect outcome.",
    },
    {
      id: "d1000000-0000-4000-8000-000000000003",
      prompt:
        "What would you like to learn and contribute in this organization?",
      guidance: "Assess curiosity, preparation, and realistic expectations.",
    },
  ];
}
