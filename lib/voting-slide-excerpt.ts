/* Text budgets for the projector slide. Pure, so the budget can be unit-tested without a browser.
   Evidence shows more before truncating, bounded by characters and lines so the projector never scrolls;
   anything cut keeps "Read full …" and the full text stays in Applicant details. */
export const SLIDE_FACT_MAX = 60
export const SLIDE_EVIDENCE_CHARS = 400
export const SLIDE_EVIDENCE_LINES = 8
export const SLIDE_FEEDBACK_CHARS = 560
export const SLIDE_FEEDBACK_LINES = 10
export const SLIDE_NOTE_CHARS = 150
/** Per-interviewer floor once the shared budget runs out: the same 100 characters each that main used before. */
export const SLIDE_FEEDBACK_MIN_CHARS = 100
export const SLIDE_FEEDBACK_MIN_LINES = 2

/** Cuts at a word boundary within `chars` (counted in characters, never splitting an emoji) and after
 *  `lines` lines; returns the text unchanged when it fits. */
export function slideExcerpt(text: string, chars = SLIDE_EVIDENCE_CHARS, lines = SLIDE_EVIDENCE_LINES) {
  const all = text.split(/\r?\n/)
  let out = all.slice(0, lines).join("\n").trimEnd()
  const glyphs = Array.from(out)
  if (glyphs.length <= chars && all.length <= lines) return text
  if (glyphs.length > chars) {
    const cut = glyphs.slice(0, chars - 1).join(""), space = cut.lastIndexOf(" ")
    out = space > cut.length * 0.8 ? cut.slice(0, space) : cut
  }
  return `${out.replace(/[\s,;:.–-]+$/, "")}…`
}

/** Budget for one interviewer's summary when `entries` interviewers share the feedback section.
 *  The total stays within SLIDE_FEEDBACK_CHARS and SLIDE_FEEDBACK_LINES until each entry reaches the
 *  per-entry floor, so adding interviewers never grows the section beyond what main allowed. */
export function feedbackBudget(entries: number) {
  if (entries <= 1) return { chars: SLIDE_EVIDENCE_CHARS, lines: SLIDE_EVIDENCE_LINES }
  return {
    chars: Math.max(SLIDE_FEEDBACK_MIN_CHARS, Math.floor(SLIDE_FEEDBACK_CHARS / entries)),
    lines: Math.max(SLIDE_FEEDBACK_MIN_LINES, Math.floor(SLIDE_FEEDBACK_LINES / entries)),
  }
}

export function feedbackExcerpt(text: string, entries: number) {
  const { chars, lines } = feedbackBudget(entries)
  return slideExcerpt(text, chars, lines)
}
