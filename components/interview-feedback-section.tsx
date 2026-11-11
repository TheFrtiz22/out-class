"use client";
import { Button } from "@/components/ui/button";
import { formatAverage, formatScore, scoredEvaluationsLabel } from "@/lib/interview-review-summary";
import { evidenceSourceLabels, interviewFeedbackEmpty, interviewFeedbackPending, type EarlierRound, type InterviewFeedback as Feedback } from "@/lib/interview-feedback";

// Presentation only: no data access, so the Voting room slide can import it without the API graph.
// Same 150-character excerpt as the slide fields; several interviewers share one cell, so each gets a shorter preview.
const preview = (text: string, limit = 150) => text.length > limit ? `${text.slice(0, limit - 3)}…` : text;

/** Read-only renderer for one round of submitted interview feedback. `compact`
 * truncates summaries for the voting slide; full text stays in its details dialog. */
export function InterviewFeedbackSection({ feedback, compact = false, onReadFull, excerpt, renderText }: { feedback: Feedback; compact?: boolean; onReadFull?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Compact only: the slide's own excerpt for each summary (count-aware) and a renderer for line breaks and lists. */
  excerpt?: (text: string, entries: number) => string; renderText?: (text: string) => React.ReactNode }) {
  const limit = feedback.entries.length > 1 ? 100 : 150, clip = (text: string) => excerpt ? excerpt(text, feedback.entries.length) : preview(text, limit);
  const truncated = compact && feedback.entries.some(e => e.summary && clip(e.summary) !== e.summary);
  return <section aria-label={`Interview feedback · ${feedback.roundName}`} data-interview-feedback={feedback.roundId} className={compact ? "space-y-1" : "space-y-2"}>
    <h3 className={compact ? undefined : "oc-card-heading"}>Interview feedback · {feedback.roundName}</h3>
    {/* On the slide the score field beside this section carries the average. */}{!compact && feedback.scoresIncluded && feedback.entries.length > 0 && <p className="text-sm" data-feedback-average><span className="text-muted-foreground">Average interview score · </span><strong>{formatAverage(feedback.average)}{feedback.average !== null && " / 10"}</strong>{feedback.average !== null && <span className="text-muted-foreground"> · {scoredEvaluationsLabel(feedback.scored)}</span>}</p>}
    {feedback.entries.length ? <ul className="divide-y">{feedback.entries.map(e => <li key={e.id} className={compact ? "py-1 first:pt-0" : "space-y-1 py-2"}>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-medium"><span>{e.interviewer}</span>{feedback.scoresIncluded && (e.score === null ? <span className="font-normal text-muted-foreground">Not scored</span> : <span className="tabular-nums"><strong className="text-base">{formatScore(e.score)}</strong><span className="font-normal text-muted-foreground"> / 10</span></span>)}</p>
      {e.summary && compact && renderText ? <div className="break-words text-sm">{renderText(clip(e.summary))}</div>
        : <p className="whitespace-pre-wrap break-words text-sm">{e.summary ? (compact ? clip(e.summary) : e.summary) : <span className="text-muted-foreground">No written summary submitted.</span>}</p>}
    </li>)}</ul> : <p className="text-sm text-muted-foreground">{interviewFeedbackEmpty(feedback.roundName)}</p>}
    {feedback.pending > 0 && <p className="text-xs text-muted-foreground">{interviewFeedbackPending(feedback.pending)}</p>}
    {truncated && onReadFull && <Button type="button" variant="link" className="h-auto min-h-11 p-0" onClick={onReadFull}>Read full interview feedback</Button>}
  </section>;
}

/** Earlier authorized rounds, each in its own labelled group with its round, interviewer and source.
 * Never merged into the current round. `compact` (voting slide) lists only each round's line. */
export function EarlierFeedbackRounds({ feedback, rounds, compact = false, onReadFull }: { feedback?: Feedback; rounds?: EarlierRound[]; compact?: boolean; onReadFull?: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const list = rounds ?? feedback?.earlierRounds ?? [];
  if (!list.length) return null;
  const line = (r: EarlierRound) => r.average !== null ? `${formatAverage(r.average)} / 10 · ${scoredEvaluationsLabel(r.submitted)}` : `${r.submitted} submitted review${r.submitted === 1 ? "" : "s"}`;
  return <section aria-label="Earlier rounds" data-earlier-rounds className={compact ? "space-y-1" : "space-y-2 border-t pt-3"}>
    <h3 className={compact ? "text-sm font-medium" : "font-medium"}>Earlier rounds</h3>
    {list.map(r => <article key={r.roundId} data-earlier-round={r.roundId} className="space-y-1">
      <p className="text-sm"><span className="font-medium">{r.roundName}</span><span className="text-muted-foreground"> · {line(r)}</span></p>
      {!compact && r.entries.length > 0 && <ul className="divide-y">{r.entries.map(e => <li key={e.id} className="space-y-1 py-2">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"><span><span className="font-medium">{e.interviewer}</span><span className="text-muted-foreground"> · {r.roundName} · {evidenceSourceLabels[e.source]}</span></span>{e.score !== null && <span className="tabular-nums"><strong>{formatScore(e.score)}</strong><span className="text-muted-foreground"> / 10</span></span>}</p>
        {e.summary && <p className="whitespace-pre-wrap break-words text-sm">{e.summary}</p>}
      </li>)}</ul>}
    </article>)}
    {compact && onReadFull && list.some(r => r.entries.length > 0) && <Button type="button" variant="link" className="h-auto min-h-11 p-0" onClick={onReadFull}>Read earlier rounds</Button>}
  </section>;
}
