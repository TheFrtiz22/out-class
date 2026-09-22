import { z } from "zod"

export const applicationInputSchema = z.object({
  clubId: z.string().uuid(),
  answers: z
    .array(z.object({ questionId: z.string().uuid(), response: z.string().max(100000) }))
    .max(200),
})
export type ApplicationQuestion = {
  id: string
  prompt: string
  type: "ESSAY" | "FILE_UPLOAD" | "MULTIPLE_CHOICE"
  required: boolean
  wordLimit: number | null
}
export const applicationStatusLabels: Record<string, string> = {
  DRAFTING: "Draft",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  INTERVIEWING: "Interview",
  ACCEPTED: "Accepted",
  REJECTED: "Not selected",
  WAITLISTED: "Waitlisted",
}
export function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0
}
export function answerErrors(
  questions: ApplicationQuestion[],
  answers: { questionId: string; response: string }[],
  final: boolean,
) {
  const errors: Record<string, string> = {}
  const seen = new Set<string>()
  for (const answer of answers) {
    const question = questions.find((item) => item.id === answer.questionId)
    if (!question || seen.has(answer.questionId)) {
      errors[answer.questionId] =
        "The application questions have changed. Reload before continuing."
      continue
    }
    seen.add(answer.questionId)
    if (answer.response.trim() && question.type === "FILE_UPLOAD") {
      try {
        const url = new URL(answer.response)
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error()
      } catch {
        errors[question.id] = "Use a complete http or https document URL."
      }
    }
    if (
      final &&
      question.type === "ESSAY" &&
      question.wordLimit != null &&
      wordCount(answer.response) > question.wordLimit
    )
      errors[question.id] = `Keep your answer within ${question.wordLimit} words.`
  }
  if (final)
    for (const question of questions) {
      if (
        question.required &&
        !answers.some((answer) => answer.questionId === question.id && answer.response.trim())
      )
        errors[question.id] = "This question needs a response before you submit."
    }
  return errors
}
export function applicationNextStep(status: string) {
  switch (status) {
    case "DRAFTING":
      return "Finish your responses when you’re ready."
    case "SUBMITTED":
      return "Your application is submitted. No further action right now."
    case "IN_REVIEW":
      return "The club is reviewing your application."
    case "INTERVIEWING":
      return "Check your interview details and calendar."
    case "ACCEPTED":
      return "You’ve been accepted. Check the club’s instructions for next steps."
    case "REJECTED":
      return "The club has not selected your application this time."
    case "WAITLISTED":
      return "You’re on the waitlist. A place is not confirmed yet."
    default:
      return "Check your application for the latest details."
  }
}
