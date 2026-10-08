import { z } from "zod"
import { storagePathSchema, resumeReferenceSchema } from "@/lib/student-profile"

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
  options?: string[]
  wordLimit: number | null
}
export { applicationStatusLabels } from "@/lib/application-status"
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
      if (!resumeReferenceSchema.safeParse(answer.response).success) {
        errors[question.id] = "Use an uploaded PDF or a valid document URL."
      }
    }
    if (answer.response.trim() && question.type === "MULTIPLE_CHOICE" && question.options?.length && !question.options.includes(answer.response))
      errors[question.id] = "Choose one of the available options."
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

/** Uploaded documents use private resumes-bucket keys; existing external links remain supported. */
export function normalizeApplicationAttachments(questions: ApplicationQuestion[], answers: { questionId: string; response: string }[]) {
  return answers.map(answer => questions.some(q => q.id === answer.questionId && q.type === "FILE_UPLOAD") && answer.response.trim()
    ? { ...answer, response: resumeReferenceSchema.parse(answer.response) } : answer)
}
export function isApplicationAttachment(value: string) {
  if (isApplicationStoragePath(value)) return true
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:" } catch { return false }
}
export function isApplicationStoragePath(value: string) {
  const parsed = storagePathSchema.safeParse(value)
  return !!value && parsed.success && parsed.data === value
}
export function applicationAttachmentUrl(value: string, applicationId: string, questionId: string) {
  if (isApplicationStoragePath(value))
    return `/api/application-attachments?applicationId=${encodeURIComponent(applicationId)}&questionId=${encodeURIComponent(questionId)}`
  return isApplicationAttachment(value) ? value : undefined
}
export function assertApplicationAttachmentOwnership(questions: ApplicationQuestion[], answers: { questionId: string; response: string }[], userId: string) {
  for (const answer of answers) {
    if (questions.some(q => q.id === answer.questionId && q.type === "FILE_UPLOAD") &&
        isApplicationStoragePath(answer.response) && !answer.response.startsWith(`${userId}/`))
      throw new Error("You can only attach your own uploaded documents.")
  }
}

/** Progress reflects valid required responses, including word limits and choice/file validation. */
export function applicationResponseProgress(questions: ApplicationQuestion[], answers: { questionId: string; response: string }[]) {
  const errors = answerErrors(questions, answers, true)
  const required = questions.filter(question => question.required)
  const completed = required.filter(question => answers.some(answer => answer.questionId === question.id && answer.response.trim()) && !errors[question.id]).length
  return { completed, total: required.length, percent: required.length ? completed / required.length * 100 : 100,
    ready: Object.keys(errors).length === 0, nextQuestionId: questions.find(question => errors[question.id])?.id }
}
