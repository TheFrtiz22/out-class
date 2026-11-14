"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect, useRef, useState } from "react";
import { isAccessRevoked } from "@/lib/action-result";
import { getEarlierInterviewReviews, getInterviewRoundScore } from "@/lib/workspace-api";
import type { InterviewScope } from "@/lib/interview-access";
import { formatAverage, scoredEvaluationsLabel, type RoundScoreSummary } from "@/lib/interview-review-summary";
import { Button } from "@/components/ui/button";
/** `onAccessRevoked` (optional, the interview room's handler) takes over an ACCESS_REVOKED refusal:
 * polling stops and the room shows its access-removed state. Without it the inline message and Retry stay. */
type ReferenceProps = { scope: InterviewScope; onAccessRevoked?: () => void };
/** Reads `request` now, every 10 s while visible, and on focus, until unmounted or refused with ACCESS_REVOKED
 * while a handler is present. Results and refusals that arrive after it stopped are ignored. */
function useReferencePoll<T>(enabled: boolean, request: () => Promise<T>, onValue: (value: T) => void, onError: () => void, onAccessRevoked: (() => void) | undefined, deps: unknown[]) {
  const handler = useRef(onAccessRevoked); handler.current = onAccessRevoked;
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const stop = () => { current = false; clearInterval(interval); window.removeEventListener("focus", read); };
    const read = () => { if (!current) return; void request().then(v => { if (current) onValue(v); }).catch(e => {
      if (!current) return;
      if (isAccessRevoked(e) && handler.current) { stop(); handler.current(); return; }
      onError();
    }); };
    read(); const interval = setInterval(() => { if (!document.hidden) read(); }, 10000);
    window.addEventListener("focus", read);
    return stop;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
export function RoundScore({ scope, onAccessRevoked }: ReferenceProps) {
  const [value, setValue] = useState<RoundScoreSummary | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useReferencePoll(true, () => getInterviewRoundScore(scope), v => { setValue(v); setError(false); }, () => { setValue(null); setError(true); }, onAccessRevoked, [scope.clubId, scope.applicationId, scope.roundId, retry]);
  return <section aria-label="Round score" className="oc-round-score"><h3>Average interview score</h3>{error ? <p role="status">Round scores unavailable under current access. <Button type="button" variant="ghost" onClick={() => setRetry(v => v + 1)}>Retry</Button></p> : value ? <><p>{formatAverage(value.average)}{value.average !== null && " / 10"}{value.provisional && " · Provisional"}</p><p className="text-xs text-muted-foreground">{value.average === null ? `${value.submitted} of ${value.required} reviews submitted` : `${scoredEvaluationsLabel(value.submitted)} · ${value.submitted} of ${value.required} reviews submitted`}</p></> : <LoadingState label="Loading round scores…" layout="inline" />}</section>;
}
export function EarlierRounds({ scope, onAccessRevoked }: ReferenceProps) {
  const [open, setOpen] = useState(false), [value, setValue] = useState<Awaited<ReturnType<typeof getEarlierInterviewReviews>> | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { setValue(null); setError(false); }, [open, scope.clubId, scope.applicationId, scope.roundId, retry]);
  useReferencePoll(open, () => getEarlierInterviewReviews(scope), v => { setValue(v); setError(false); }, () => { setValue(null); setError(true); }, onAccessRevoked, [open, scope.clubId, scope.applicationId, scope.roundId, retry]);
  return <section className="oc-earlier-rounds"><Button type="button" variant="ghost" aria-expanded={open} aria-controls="earlier-interview-reviews" onClick={() => setOpen(v => !v)}>Earlier rounds</Button>{open && <div id="earlier-interview-reviews" className="space-y-4">{error ? <p role="alert">Earlier reviews unavailable. Your assignment or access may have changed. <Button type="button" variant="ghost" onClick={() => setRetry(v => v + 1)}>Retry</Button></p> : value === null ? <LoadingState label="Loading earlier reviews…" layout="rows" rows={2} /> : !value.length ? <p>No earlier submitted reviews available.</p> : value.map(r => <article key={r.id} className="space-y-2 border-t pt-3"><h3 className="font-medium">{r.roundName} · {r.reviewer}</h3><p>{r.score} / 10 · <time dateTime={r.submittedAt}>{new Date(r.submittedAt).toLocaleDateString()}</time></p>{r.questions === null ? <p className="text-muted-foreground">Finalized question notes were not shared for this legacy review.</p> : <ul className="space-y-3">{r.questions.map(q => <li key={q.id}><p>{q.prompt}{q.offScript && " · Off-script"}</p><p className="whitespace-pre-wrap text-muted-foreground">{q.notes || "No question notes recorded."}</p></li>)}</ul>}<h4>Miscellaneous notes</h4><p className="whitespace-pre-wrap">{r.additionalNotes || "None recorded."}</p><h4>Final interview thoughts</h4><p className="whitespace-pre-wrap">{r.finalInterviewThoughts || "None recorded."}</p><h4>Questions the applicant asked · Historical</h4><p className="whitespace-pre-wrap">{r.applicantQuestions || "None recorded."}</p></article>)}</div>}</section>;
}
