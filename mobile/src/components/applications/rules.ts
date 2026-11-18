import type { ApplicationAnswer, ApplicationQuestion } from "~/lib/types";

/**
 * The form's live, in-browser helpers from the web's lib/student-applications.ts, ported line for
 * line because the form needs them on every keystroke (follow-up question visibility, word counts,
 * the "required responses ready" count, and the `expectedAnswers` token of the save contract).
 * They decide nothing: the server runs the originals on every save and submit and its refusal is
 * what the app shows. Keep in step with the web file (candidate for packages/shared).
 */
export function selectedOptions(question: Pick<ApplicationQuestion, "type">, response: string): string[] {
  if (!response.trim()) return [];
  if (question.type === "MULTIPLE_CHOICE") return [response];
  if (question.type !== "MULTI_SELECT") return [];
  try {
    const value: unknown = JSON.parse(response);
    return Array.isArray(value) && value.every(item => typeof item === "string") ? value : [];
  } catch { return []; }
}
export function encodeSelections(options: readonly string[]) { return options.length ? JSON.stringify([...options]) : ""; }

function questionCondition(value: unknown): { questionId: string; anyOf: string[] } | null {
  if (!value || typeof value !== "object") return null;
  const { questionId, anyOf } = value as { questionId?: unknown; anyOf?: unknown };
  return typeof questionId === "string" && Array.isArray(anyOf) && anyOf.length > 0 && anyOf.every(item => typeof item === "string") ? { questionId, anyOf } : null;
}
/** Questions the applicant currently sees: a follow-up appears only after the answer it depends on. */
export function visibleQuestionIds(questions: ApplicationQuestion[], answers: ApplicationAnswer[]) {
  const visible = new Set<string>();
  for (const question of questions) {
    const condition = question.showIf ? questionCondition(question.showIf) : null;
    if (!condition) { visible.add(question.id); continue; }
    const parent = questions.find(item => item.id === condition.questionId);
    if (!parent || !visible.has(parent.id)) continue;
    const response = answers.find(answer => answer.questionId === parent.id)?.response ?? "";
    if (selectedOptions(parent, response).some(option => condition.anyOf.includes(option))) visible.add(question.id);
  }
  return visible;
}
export function wordCount(value: string) { return value.trim() ? value.trim().split(/\s+/u).length : 0; }

/** The web's answerErrors, with its wording. Document links are checked by the server only. */
export function answerErrors(questions: ApplicationQuestion[], answers: ApplicationAnswer[], final: boolean) {
  const errors: Record<string, string> = {};
  for (const answer of answers) {
    const question = questions.find(item => item.id === answer.questionId);
    if (!question) { errors[answer.questionId] = "The application questions have changed. Reload before continuing."; continue; }
    if (answer.response.trim() && question.type === "MULTIPLE_CHOICE" && question.options?.length && !question.options.includes(answer.response))
      errors[question.id] = "Choose one of the available options.";
    if (answer.response.trim() && question.type === "MULTI_SELECT") {
      const chosen = selectedOptions(question, answer.response);
      if (!chosen.length || new Set(chosen).size !== chosen.length || chosen.some(option => !question.options?.includes(option)))
        errors[question.id] = "Choose from the available options.";
    }
    if (final && question.type === "ESSAY" && question.wordLimit != null && wordCount(answer.response) > question.wordLimit)
      errors[question.id] = `Keep your answer within ${question.wordLimit} words.`;
  }
  if (final) {
    const visible = visibleQuestionIds(questions, answers);
    for (const question of questions) {
      if (question.required && visible.has(question.id) && !answers.some(answer => answer.questionId === question.id && answer.response.trim()))
        errors[question.id] = "This question needs a response before you submit.";
    }
  }
  return errors;
}
export function responseProgress(questions: ApplicationQuestion[], answers: ApplicationAnswer[]) {
  const errors = answerErrors(questions, answers, true);
  const visible = visibleQuestionIds(questions, answers);
  const required = questions.filter(question => question.required && visible.has(question.id));
  const completed = required.filter(question => answers.some(answer => answer.questionId === question.id && answer.response.trim()) && !errors[question.id]).length;
  return { completed, total: required.length, nextQuestionId: questions.find(question => errors[question.id])?.id };
}
/** The compare token of the save contract (`expectedAnswers`). */
export function answersKey(answers: ApplicationAnswer[]) {
  return JSON.stringify(answers.filter(answer => answer.response !== "").map(answer => [answer.questionId, answer.response]).sort((a, b) => a[0]!.localeCompare(b[0]!)));
}
/** Longest answer one question accepts; the essay box stops typing at the same length. */
export const MAX_ANSWER_CHARACTERS = 100000;
