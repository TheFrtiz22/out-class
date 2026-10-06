"use client";
import { useEffect, useState } from "react";
import { getSubmittedInterviewReview, getSubmittedInterviewReviews } from "@/lib/workspace-api";
import { Button } from "@/components/ui/button";
type Row = Awaited<ReturnType<typeof getSubmittedInterviewReviews>>[number];
type Review = Awaited<ReturnType<typeof getSubmittedInterviewReview>>;
export function InterviewSubmittedReviews({ clubId }: { clubId: string }) {
  const [rows, setRows] = useState<Row[]>([]), [selected, setSelected] = useState<Row | null>(null), [review, setReview] = useState<Review | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true, pending = false;
    const refresh = async () => {
      if (pending) return; pending = true;
      try { const result = await getSubmittedInterviewReviews(clubId); if (current) { setRows(result); setError(""); setSelected(value => value ? result.find(r => r.id === value.id) || null : null); } }
      catch { if (current) { setRows([]); setSelected(null); setReview(null); setError("Submitted reviews unavailable. Check your current leadership access."); } }
      finally { pending = false; if (current) setLoading(false); }
    };
    const visible = () => { if (!document.hidden) void refresh(); };
    setRows([]); setSelected(null); setReview(null); setLoading(true); void refresh();
    const timer = setInterval(visible, 10000); window.addEventListener("focus", visible);
    return () => { current = false; clearInterval(timer); window.removeEventListener("focus", visible); };
  }, [clubId, retry]);
  useEffect(() => {
    setReview(null);
    if (!selected) return;
    let current = true, pending = false;
    const refresh = async () => {
      if (pending) return; pending = true;
      try { const result = await getSubmittedInterviewReview({ clubId, applicationId: selected.applicationId, roundId: selected.roundId, interviewerId: selected.interviewerId }); if (current) { setReview(result); setError(""); } }
      catch { if (current) { setReview(null); setSelected(null); setRows([]); setError("This review is no longer available with your current access."); } }
      finally { pending = false; }
    };
    const visible = () => { if (!document.hidden) void refresh(); };
    void refresh(); const timer = setInterval(visible, 10000); window.addEventListener("focus", visible);
    return () => { current = false; clearInterval(timer); window.removeEventListener("focus", visible); };
  }, [clubId, selected]);
  return <section className="space-y-4 p-4" aria-label="Submitted interview reviews">
    <h2 className="oc-section-heading">Submitted interview reviews</h2>
    <p className="text-sm text-muted-foreground">Read-only closing reviews, including previous rounds. The latest 100 submitted reviews are shown. Private question notes are not included.</p>
    <Button type="button" variant="outline" onClick={() => setRetry(v => v + 1)}>Refresh reviews</Button>
    {loading && <p role="status">Loading reviews…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && !rows.length && <p role="status">No submitted reviews available.</p>}
    <ul className="flex flex-wrap gap-2">{rows.map(row => <li key={row.id}><Button type="button" variant={selected?.id === row.id ? "secondary" : "outline"} className="h-auto whitespace-normal text-left" aria-pressed={selected?.id === row.id} onClick={() => { setReview(null); setSelected(row); }}>{row.applicantName} · {row.roundName} · Open review</Button></li>)}</ul>
    {selected && <section aria-label="Read-only closing review" className="space-y-4 rounded-lg border bg-card p-4">
      <h3 className="font-medium">{selected.applicantName} · {selected.roundName}</h3>
      {!review ? <p role="status">Loading closing review…</p> : <><p className="text-xs text-muted-foreground">{review.submittedAt ? `Submitted ${new Date(review.submittedAt).toLocaleString()} · ` : ""}Read only</p>{review.textUnavailable && <p role="status">Closing text is unavailable under anonymous review rules. Potentially identifying text is withheld.</p>}<dl className="space-y-4"><div><dt className="font-medium">Questions the applicant asked</dt><dd className="whitespace-pre-wrap break-words">{review.textUnavailable ? "Withheld for anonymity." : review.applicantQuestions || "None recorded."}</dd></div><div><dt className="font-medium">Additional notes</dt><dd className="whitespace-pre-wrap break-words">{review.textUnavailable ? "Withheld for anonymity." : review.additionalNotes || "None recorded."}</dd></div><div><dt className="font-medium">Overall score</dt><dd>{review.score === null ? "Not scored" : `${review.score} / 10`}</dd></div></dl></>}
    </section>}
  </section>;
}
