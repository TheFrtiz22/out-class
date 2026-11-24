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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** lib/student-profile.ts `storagePathSchema`: an uploaded document's private key ("<owner>/<file>"). */
export function isUploadedDocument(value: string) {
  const text = value.trim();
  if (!text || text.includes("://") || text.startsWith("/") || text.includes("..") || /[\\%?#\x00-\x1f\x7f]/.test(text)) return false;
  const parts = text.split("/");
  return parts.length === 2 && UUID.test(parts[0]!) && parts[1]!.length > 0;
}
/** lib/student-profile.ts `normalizeWebUrl`: the address as the server stores it, or null when it is not a usable web link. */
function normalizeWebUrl(value: string): string | null {
  const text = value.trim();
  if (!text || text.startsWith("/") || /^https?:\/\/\//i.test(text) || /[\s\\\x00-\x1f]/.test(text)) return null;
  const explicit = /^[a-z][a-z0-9+.-]*:/i.test(text);
  if (explicit && !/^https?:\/\//i.test(text)) return null;
  try {
    const url = new URL(explicit ? text : `https://${text}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
/**
 * A document answer as the server stores it (lib/student-profile.ts `resumeReferenceSchema`): an
 * uploaded PDF's key, or a normalized link. Null while it is not yet valid. Sending the stored form
 * keeps the save contract's `expectedAnswers` token equal to what the server holds.
 */
export function documentReference(value: string): string | null {
  const text = value.trim();
  if (!text || isUploadedDocument(text)) return text;
  return normalizeWebUrl(text);
}

/** The web's answerErrors, with its wording. */
export function answerErrors(questions: ApplicationQuestion[], answers: ApplicationAnswer[], final: boolean) {
  const errors: Record<string, string> = {};
  // An answer to a follow-up that is now hidden is not shown and cannot be fixed, so its content rules are skipped.
  const visible = visibleQuestionIds(questions, answers);
  for (const answer of answers) {
    const question = questions.find(item => item.id === answer.questionId);
    if (!question) { errors[answer.questionId] = "The application questions have changed. Reload before continuing."; continue; }
    // A document answer is always checked: it is stored, and a club may still open it.
    if (answer.response.trim() && question.type === "FILE_UPLOAD" && documentReference(answer.response) === null)
      errors[question.id] = "Use an uploaded PDF or a valid document URL.";
    if (!visible.has(question.id)) continue;
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
