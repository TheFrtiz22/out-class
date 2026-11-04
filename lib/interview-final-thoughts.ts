/** Shared by the editor and both submission adapters. Punctuation stays in its
 * whitespace-delimited word; spaces, tabs and line breaks are equivalent. */
export const FINAL_INTERVIEW_THOUGHTS_WORD_LIMIT = 50;

export function interviewThoughtWordCount(value: string = ""): number {
  const text = value.trim();
  return text ? text.split(/\s+/u).length : 0;
}

export function validateFinalInterviewThoughts(value?: string): void {
  if (interviewThoughtWordCount(value) > FINAL_INTERVIEW_THOUGHTS_WORD_LIMIT)
    throw new Error("Final interview thoughts must be 50 words or fewer. Your draft is retained; shorten it before submitting.");
}
