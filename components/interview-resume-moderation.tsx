"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect, useMemo, useRef, useState } from "react";
import { InterviewResumeLoader as Viewer } from "@/components/interview-resume-loader";
import { useDemoMode } from "@/contexts/demo-context";
import { getInterviewResumeModerationPage } from "@/lib/workspace-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ApplicantInterviewFilters } from "@/lib/applicant-interview-navigation";
import { InterviewListMore } from "@/components/interview-list-more";
import { useInterviewListPages } from "@/hooks/use-interview-list-pages";
type Row = Awaited<ReturnType<typeof getInterviewResumeModerationPage>>["items"][number];
const rowDomId = (id: string) => `moderation-document-${id}`;
export function InterviewResumeModeration({ clubId, filters = {}, initialDocumentId }: { clubId: string; filters?: ApplicantInterviewFilters; initialDocumentId?: string }) {
  const { applicationId, roundId, cycleId } = filters;
  const { isDemoEnabled } = useDemoMode();
  const [selected, setSelected] = useState<Row | null>(null);
  // Filters are applied by the server on every page; changing one resets paging.
  const list = useInterviewListPages<Row>((cursor, limit) => getInterviewResumeModerationPage(clubId, { applicationId, roundId, cycleId }, cursor, limit), row => row.documentId, [clubId, applicationId, roundId, cycleId], "Résumé moderation unavailable. Check your current office assignment and access.", rowDomId, initialDocumentId);
  const { rows, error, loading } = list;
  const trigger = useRef<HTMLButtonElement | null>(null), heading = useRef<HTMLHeadingElement>(null);
  const scope = useMemo(() => selected ? ({ clubId, applicationId: selected.applicationId, roundId: selected.roundId }) : null, [selected, clubId]);
  useEffect(() => { setSelected(previous => rows.find(row => row.documentId === (previous?.documentId || initialDocumentId)) || null); }, [rows, initialDocumentId]);
  return <section className="space-y-4 p-4" aria-label="Résumé moderation">
    <h2 ref={heading} tabIndex={-1} className="oc-section-heading">Résumé moderation</h2>
    <p className="text-sm text-muted-foreground">Preserved interview documents, including past rounds. Only explicit presidents and vice-presidents can moderate other authors’ comments. Newest first.</p>
    {loading && <LoadingState label="Loading saved interview documents…" layout="rows" rows={3} />}{error && <p role="alert" className="text-destructive">{error} <Button type="button" variant="outline" size="sm" onClick={list.retry}>Try again</Button></p>}
    {!loading && !error && !rows.length && <p role="status">No saved interview documents are available. Documents are preserved when an authorized interviewer first opens the résumé.</p>}
    <ul className="space-y-2">{rows.map(row => <li key={row.documentId}><Button id={rowDomId(row.documentId)} type="button" variant="outline" className="h-auto whitespace-normal text-left" onClick={e => { trigger.current = e.currentTarget; setSelected(row); }}>{row.applicantName} · {row.roundName} · Review résumé</Button></li>)}</ul>
    {!error && list.seekMissing && initialDocumentId && !rows.some(r => r.documentId === initialDocumentId) && <p role="status" className="text-xs text-muted-foreground">{list.nextCursor ? "The linked document isn’t in the newest documents shown. Load more to find this document." : "The linked document isn’t available with your current access."}</p>}
    {!error && <InterviewListMore shown={rows.length} total={list.total} hasMore={!!list.nextCursor} state={list.more} announcement={list.announcement} label="documents" onMore={() => void list.loadMore()} />}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="flex h-[94dvh] max-w-[96vw] flex-col overflow-hidden sm:max-w-[96vw]" onEscapeKeyDown={event => { if ((event.target as Element)?.closest('[role="dialog"]')?.querySelector('[data-resume-comment-draft]')) event.preventDefault(); }} onCloseAutoFocus={e => { e.preventDefault(); (trigger.current?.isConnected ? trigger.current : heading.current)?.focus(); }}>
      <DialogHeader className="pr-10"><DialogTitle>{selected?.applicantName} · Résumé</DialogTitle><DialogDescription>The document preserved for {selected?.roundName}. Moderated changes are audited.</DialogDescription></DialogHeader>
      <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setSelected(null)}>Close résumé</Button>
      {selected && scope && <Viewer scope={scope} documentId={selected.documentId} isDemo={isDemoEnabled} onAccessLost={() => { list.fail(""); setSelected(null); }} />}
    </DialogContent></Dialog>
  </section>;
}
