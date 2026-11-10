import { z } from "zod"
import { storagePathSchema, resumeReferenceSchema } from "@/lib/student-profile"

export const applicationInputSchema = z.object({
  clubId: z.string().uuid(),
  expectedAnswers: z.string().max(300000).optional(),
  answers: z
    .array(z.object({ questionId: z.string().uuid(), response: z.string().max(100000) }))
    .max(200),
})
export type ApplicationQuestion = {
  id: string
  prompt: string
  type: "ESSAY" | "FILE_UPLOAD" | "MULTIPLE_CHOICE" | "MULTI_SELECT"
  required: boolean
  options?: string[]
  wordLimit: number | null
  /** Shown only when an earlier choice question has one of these answers. */
  showIf?: unknown
}
export type QuestionCondition = { questionId: string; anyOf: string[] }
export const questionConditionSchema = z.object({ questionId: z.string().uuid(), anyOf: z.array(z.string().min(1).max(300)).min(1).max(30) }).strict()
export function questionCondition(value: unknown): QuestionCondition | null {
  const parsed = questionConditionSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** The options a response selects. "Select all that apply" answers are stored as a JSON array. */
export function selectedOptions(question: Pick<ApplicationQuestion, "type">, response: string): string[] {
  if (!response.trim()) return []
  if (question.type === "MULTIPLE_CHOICE") return [response]
  if (question.type !== "MULTI_SELECT") return []
  try {
    const value: unknown = JSON.parse(response)
    return Array.isArray(value) && value.every(item => typeof item === "string") ? value : []
  } catch { return [] }
}
export function encodeSelections(options: readonly string[]) { return options.length ? JSON.stringify([...options]) : "" }
/** How a response reads to a reviewer. */
export function answerText(question: Pick<ApplicationQuestion, "type">, response: string) {
  return question.type === "MULTI_SELECT" ? selectedOptions(question, response).join(", ") : response
}

/** Questions the applicant currently sees. A conditional question is visible only
 * when its (visible) parent choice question has a matching answer. */
export function visibleQuestionIds(questions: ApplicationQuestion[], answers: { questionId: string; response: string }[]) {
  const visible = new Set<string>()
  for (const question of questions) {
    const condition = question.showIf ? questionCondition(question.showIf) : null
    if (!condition) { visible.add(question.id); continue }
    const parent = questions.find(item => item.id === condition.questionId)
    if (!parent || !visible.has(parent.id)) continue
    const response = answers.find(answer => answer.questionId === parent.id)?.response ?? ""
    if (selectedOptions(parent, response).some(option => condition.anyOf.includes(option))) visible.add(question.id)
  }
  return visible
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
    if (answer.response.trim() && question.type === "MULTI_SELECT") {
      const chosen = selectedOptions(question, answer.response)
      if (!chosen.length || new Set(chosen).size !== chosen.length || chosen.some(option => !question.options?.includes(option)))
        errors[question.id] = "Choose from the available options."
    }
    if (
      final &&
      question.type === "ESSAY" &&
      question.wordLimit != null &&
      wordCount(answer.response) > question.wordLimit
    )
      errors[question.id] = `Keep your answer within ${question.wordLimit} words.`
  }
  if (final) {
    const visible = visibleQuestionIds(questions, answers)
    for (const question of questions) {
      if (
        question.required && visible.has(question.id) &&
        !answers.some((answer) => answer.questionId === question.id && answer.response.trim())
      )
        errors[question.id] = "This question needs a response before you submit."
    }
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
  const visible = visibleQuestionIds(questions, answers)
  const required = questions.filter(question => question.required && visible.has(question.id))
  const completed = required.filter(question => answers.some(answer => answer.questionId === question.id && answer.response.trim()) && !errors[question.id]).length
  return { completed, total: required.length, percent: required.length ? completed / required.length * 100 : 100,
    ready: Object.keys(errors).length === 0, nextQuestionId: questions.find(question => errors[question.id])?.id }
}


/** Canonical compare token without requiring a database revision column. */
export function applicationAnswersKey(answers: { questionId: string; response: string }[]) {
  return JSON.stringify(answers.filter(a => a.response !== "").map(a => [a.questionId, a.response]).sort((a, b) => a[0].localeCompare(b[0])))
}
