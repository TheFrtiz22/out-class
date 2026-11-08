"use client";
import { Button } from "@/components/ui/button";
import { formatAverage, formatScore, scoredEvaluationsLabel } from "@/lib/interview-review-summary";
import { interviewFeedbackEmpty, interviewFeedbackPending, type InterviewFeedback as Feedback } from "@/lib/interview-feedback";

// Presentation only: no data access, so the Voting room slide can import it without the API graph.
// Same 150-character excerpt as the slide fields; several interviewers share one cell, so each gets a shorter preview.
const preview = (text: string, limit = 150) => text.length > limit ? `${text.slice(0, limit - 3)}…` : text;

/** Read-only renderer for one round of submitted interview feedback. `compact`
 * truncates summaries for the voting slide; full text stays in its details dialog. */
export function InterviewFeedbackSection({ feedback, compact = false, onReadFull }: { feedback: Feedback; compact?: boolean; onReadFull?: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const limit = feedback.entries.length > 1 ? 100 : 150, truncated = compact && feedback.entries.some(e => e.summary && preview(e.summary, limit) !== e.summary);
  return <section aria-label={`Interview feedback · ${feedback.roundName}`} data-interview-feedback={feedback.roundId} className={compact ? "space-y-1" : "space-y-2"}>
    <h3 className={compact ? undefined : "oc-card-heading"}>Interview feedback · {feedback.roundName}</h3>
    {/* On the slide the score field beside this section carries the average. */}{!compact && feedback.scoresIncluded && feedback.entries.length > 0 && <p className="text-sm" data-feedback-average><span className="text-muted-foreground">Average interview score · </span><strong>{formatAverage(feedback.average)}{feedback.average !== null && " / 10"}</strong>{feedback.average !== null && <span className="text-muted-foreground"> · {scoredEvaluationsLabel(feedback.scored)}</span>}</p>}
    {feedback.entries.length ? <ul className="divide-y">{feedback.entries.map(e => <li key={e.id} className={compact ? "py-1 first:pt-0" : "space-y-1 py-2"}>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-medium"><span>{e.interviewer}</span>{feedback.scoresIncluded && (e.score === null ? <span className="font-normal text-muted-foreground">Not scored</span> : <span className="tabular-nums"><strong className="text-base">{formatScore(e.score)}</strong><span className="font-normal text-muted-foreground"> / 10</span></span>)}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{e.summary ? (compact ? preview(e.summary, limit) : e.summary) : <span className="text-muted-foreground">No written summary submitted.</span>}</p>
    </li>)}</ul> : <p className="text-sm text-muted-foreground">{interviewFeedbackEmpty(feedback.roundName)}</p>}
    {feedback.pending > 0 && <p className="text-xs text-muted-foreground">{interviewFeedbackPending(feedback.pending)}</p>}
    {truncated && onReadFull && <Button type="button" variant="link" className="h-auto min-h-11 p-0" onClick={onReadFull}>Read full interview feedback</Button>}
  </section>;
}

/** Earlier authorized rounds as labelled references only, never merged into the section. */
export function EarlierFeedbackRounds({ feedback }: { feedback: Feedback }) {
  if (!feedback.earlierRounds.length) return null;
  return <p className="text-xs text-muted-foreground" aria-label="Earlier interview rounds">Earlier rounds: {feedback.earlierRounds.map(r => `${r.roundName} · ${r.submitted} submitted review${r.submitted === 1 ? "" : "s"}`).join("; ")}</p>;
}
