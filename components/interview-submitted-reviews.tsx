"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect, useState } from "react";
import { getSubmittedInterviewReview, getSubmittedInterviewReviewPage } from "@/lib/workspace-api";
import { RoundScore } from "@/components/interview-review-references";
import { Button } from "@/components/ui/button";
import type { ApplicantInterviewFilters } from "@/lib/applicant-interview-navigation";
import { Panel } from "@/components/ui/panel";
import { ApplicantIdentity } from "@/components/applicant-identity";
import { InterviewListMore } from "@/components/interview-list-more";
import { useInterviewListPages } from "@/hooks/use-interview-list-pages";
type Row = Awaited<ReturnType<typeof getSubmittedInterviewReviewPage>>["items"][number];
const rowDomId = (id: string) => `submitted-review-${id}`;
type Review = Awaited<ReturnType<typeof getSubmittedInterviewReview>>;
export function InterviewSubmittedReviews({ clubId, filters = {}, initialReviewId }: { clubId: string; filters?: ApplicantInterviewFilters; initialReviewId?: string }) {
  const { applicationId, roundId, cycleId } = filters;
  const [selected, setSelected] = useState<Row | null>(null), [review, setReview] = useState<Review | null>(null);
  // Filters are applied by the server on every page; changing one resets paging.
  const list = useInterviewListPages<Row>(cursor => getSubmittedInterviewReviewPage(clubId, { applicationId, roundId, cycleId }, cursor), row => row.id, [clubId, applicationId, roundId, cycleId], "Submitted reviews unavailable. Check your current leadership access.", rowDomId);
  const { rows, error, loading } = list;
  useEffect(() => {
    setSelected(value => value ? rows.find(r => r.id === value.id) || null : rows.find(r => r.id === (initialReviewId || new URLSearchParams(typeof window !== "undefined" ? window.location?.search || "" : "").get("reviewId"))) || null);
  }, [rows, initialReviewId]);
  useEffect(() => {
    setReview(null);
    if (!selected) return;
    let current = true, pending = false;
    const refresh = async () => {
      if (pending) return; pending = true;
      try { const result = await getSubmittedInterviewReview({ clubId, applicationId: selected.applicationId, roundId: selected.roundId, interviewerId: selected.interviewerId }); if (current) setReview(result); }
      catch { if (current) { setReview(null); setSelected(null); list.fail("This review is no longer available with your current access."); } }
      finally { pending = false; }
    };
    const visible = () => { if (!document.hidden) void refresh(); };
    void refresh(); const timer = setInterval(visible, 10000); window.addEventListener("focus", visible);
    return () => { current = false; clearInterval(timer); window.removeEventListener("focus", visible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- list.fail only clears list state
  }, [clubId, selected]);
  return <section className="space-y-4 p-4" aria-label="Submitted interview reviews">
    <h2 className="oc-section-heading">Submitted interview reviews</h2>
    <p className="text-sm text-muted-foreground">Read-only closing reviews, including previous rounds. Newest first. Private question notes are not included.</p>
    {loading && <LoadingState label="Loading reviews…" layout="rows" rows={2} />}{error && <p role="alert">{error} <Button type="button" variant="outline" size="sm" onClick={list.retry}>Try again</Button></p>}
    {!loading && !error && !rows.length && <p role="status">No submitted reviews available.</p>}
    <ul className="flex flex-wrap gap-2">{rows.map(row => <li key={row.id}><Button id={rowDomId(row.id)} type="button" variant={selected?.id === row.id ? "secondary" : "outline"} className="h-auto min-h-11 whitespace-normal py-2 text-left" aria-pressed={selected?.id === row.id} aria-label={`${row.applicantName} · ${row.roundName} · Open review`} onClick={() => { setReview(null); setSelected(row); if (window.location?.href && window.history) { const url = new URL(window.location.href); url.searchParams.set("reviewId", row.id); window.history.replaceState(null, "", url.pathname + url.search); } }}><ApplicantIdentity name={row.applicantName} photo={row.photo} anonymous={row.anonymous}><span className="text-xs font-normal text-muted-foreground">{row.roundName} · Open review</span></ApplicantIdentity></Button></li>)}</ul>
    {!error && <InterviewListMore shown={rows.length} total={list.total} hasMore={!!list.nextCursor} state={list.more} announcement={list.announcement} label="reviews" onMore={() => void list.loadMore()} />}
    {selected && <Panel as="section" aria-label="Read-only closing review" className="space-y-4">
      <ApplicantIdentity size="lg" name={selected.applicantName} photo={selected.photo} anonymous={selected.anonymous} heading={<h3 className="font-medium">{selected.applicantName}</h3>}><span className="text-sm text-muted-foreground">{selected.roundName}</span></ApplicantIdentity>
      {review && <RoundScore key={selected.id} scope={{ clubId, applicationId: selected.applicationId, roundId: selected.roundId }} />}
      {!review ? <LoadingState label="Loading closing review…" layout="rows" rows={2} /> : <><p className="text-xs text-muted-foreground">{review.submittedAt ? `Submitted ${new Date(review.submittedAt).toLocaleString()} · ` : ""}Read only</p>{review.textUnavailable && <p role="status">Closing text is unavailable under anonymous review rules. Potentially identifying text is withheld.</p>}<dl className="space-y-4"><div><dt className="font-medium">Final interview thoughts</dt><dd className="whitespace-pre-wrap break-words">{review.textUnavailable ? "Withheld for anonymity." : review.finalInterviewThoughts || "None recorded."}</dd></div><div><dt className="font-medium">Questions the applicant asked · Historical</dt><dd className="whitespace-pre-wrap break-words">{review.textUnavailable ? "Withheld for anonymity." : review.applicantQuestions || "None recorded."}</dd></div><div><dt className="font-medium">Additional notes</dt><dd className="whitespace-pre-wrap break-words">{review.textUnavailable ? "Withheld for anonymity." : review.additionalNotes || "None recorded."}</dd></div><div><dt className="font-medium">Overall score</dt><dd>{review.score === null ? "Not scored" : `${review.score} / 10`}</dd></div></dl></>}
    </Panel>}
  </section>;
}
