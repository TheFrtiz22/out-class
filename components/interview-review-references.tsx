"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect, useState } from "react";
import { getEarlierInterviewReviews, getInterviewRoundScore } from "@/lib/workspace-api";
import type { InterviewScope } from "@/lib/interview-access";
import { formatAverage, type RoundScoreSummary } from "@/lib/interview-review-summary";
import { Button } from "@/components/ui/button";
export function RoundScore({ scope }: { scope: InterviewScope }) {
  const [value, setValue] = useState<RoundScoreSummary | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    const read = () => getInterviewRoundScore(scope).then(v => { if (current) { setValue(v); setError(false); } }).catch(() => { if (current) { setValue(null); setError(true); } });
    void read(); const interval = setInterval(() => { if (!document.hidden) void read(); }, 10000);
    window.addEventListener("focus", read);
    return () => { current = false; clearInterval(interval); window.removeEventListener("focus", read); };
  }, [scope.clubId, scope.applicationId, scope.roundId, retry]); // eslint-disable-line react-hooks/exhaustive-deps
  return <section aria-label="Round score" className="oc-round-score"><h3>Round average</h3>{error ? <p role="status">Round scores unavailable under current access. <Button type="button" variant="ghost" onClick={() => setRetry(v => v + 1)}>Retry</Button></p> : value ? <><p>{formatAverage(value.average)}{value.average !== null && " / 10"}{value.provisional && " · Provisional"}</p><p className="text-xs text-muted-foreground">{value.submitted} of {value.required} reviews submitted</p></> : <LoadingState label="Loading round scores…" layout="inline" />}</section>;
}
export function EarlierRounds({ scope }: { scope: InterviewScope }) {
  const [open, setOpen] = useState(false), [value, setValue] = useState<Awaited<ReturnType<typeof getEarlierInterviewReviews>> | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    setValue(null); setError(false); if (!open) return;
    let current = true;
    const read = () => getEarlierInterviewReviews(scope).then(v => { if (current) { setValue(v); setError(false); } }).catch(() => { if (current) { setValue(null); setError(true); } });
    void read(); const interval = setInterval(() => { if (!document.hidden) void read(); }, 10000);
    window.addEventListener("focus", read);
    return () => { current = false; clearInterval(interval); window.removeEventListener("focus", read); };
  }, [open, scope.clubId, scope.applicationId, scope.roundId, retry]); // eslint-disable-line react-hooks/exhaustive-deps
  return <section className="oc-earlier-rounds"><Button type="button" variant="ghost" aria-expanded={open} aria-controls="earlier-interview-reviews" onClick={() => setOpen(v => !v)}>Earlier rounds</Button>{open && <div id="earlier-interview-reviews" className="space-y-4">{error ? <p role="alert">Earlier reviews unavailable. Your assignment or access may have changed. <Button type="button" variant="ghost" onClick={() => setRetry(v => v + 1)}>Retry</Button></p> : value === null ? <LoadingState label="Loading earlier reviews…" layout="rows" rows={2} /> : !value.length ? <p>No earlier submitted reviews available.</p> : value.map(r => <article key={r.id} className="space-y-2 border-t pt-3"><h3 className="font-medium">{r.roundName} · {r.reviewer}</h3><p>{r.score} / 10 · <time dateTime={r.submittedAt}>{new Date(r.submittedAt).toLocaleDateString()}</time></p>{r.questions === null ? <p className="text-muted-foreground">Finalized question notes were not shared for this legacy review.</p> : <ul className="space-y-3">{r.questions.map(q => <li key={q.id}><p>{q.prompt}{q.offScript && " · Off-script"}</p><p className="whitespace-pre-wrap text-muted-foreground">{q.notes || "No question notes recorded."}</p></li>)}</ul>}<h4>Miscellaneous notes</h4><p className="whitespace-pre-wrap">{r.additionalNotes || "None recorded."}</p><h4>Questions the applicant asked</h4><p className="whitespace-pre-wrap">{r.applicantQuestions || "None recorded."}</p></article>)}</div>}</section>;
}
