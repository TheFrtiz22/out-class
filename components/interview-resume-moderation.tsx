"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { InterviewResumeLoader as Viewer } from "@/components/interview-resume-loader";
import { useDemoMode } from "@/contexts/demo-context";
import { getInterviewResumeModerationQueue } from "@/lib/workspace-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
type Row = Awaited<ReturnType<typeof getInterviewResumeModerationQueue>>[number];
export function InterviewResumeModeration({ clubId }: { clubId: string }) {
  const { isDemoEnabled } = useDemoMode();
  const [rows, setRows] = useState<Row[]>([]), [selected, setSelected] = useState<Row | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const trigger = useRef<HTMLButtonElement | null>(null), refreshButton = useRef<HTMLButtonElement>(null);
  const scope = useMemo(() => selected ? ({ clubId, applicationId: selected.applicationId, roundId: selected.roundId }) : null, [selected, clubId]);
  useEffect(() => {
    let current = true, pending = false;
    const refresh = async () => {
      if (pending) return; pending = true;
      try { const value = await getInterviewResumeModerationQueue(clubId); if (current) { setRows(value); setError(""); } }
      catch { if (current) { setRows([]); setSelected(null); setError("Résumé moderation unavailable. Check your current office assignment and access."); } }
      finally { pending = false; if (current) setLoading(false); }
    };
    const visible = () => { if (!document.hidden) void refresh(); };
    setRows([]); setSelected(null); setLoading(true); void refresh();
    const timer = setInterval(visible, 10000); window.addEventListener("focus", visible);
    return () => { current = false; clearInterval(timer); window.removeEventListener("focus", visible); };
  }, [clubId, retry]);
  return <section className="space-y-4 p-4" aria-label="Résumé moderation">
    <h2 className="oc-section-heading">Résumé moderation</h2>
    <p className="text-sm text-muted-foreground">Preserved interview documents, including past rounds. Only explicit presidents and vice-presidents can moderate other authors’ comments. The latest 100 documents are shown.</p>
    <Button ref={refreshButton} type="button" variant="outline" size="sm" onClick={() => setRetry(v => v + 1)}>Refresh documents</Button>
    {loading && <p role="status">Loading saved documents…</p>}{error && <p role="alert" className="text-destructive">{error}</p>}
    {!loading && !error && !rows.length && <p role="status">No saved interview documents are available. Documents are preserved when an authorized interviewer first opens the résumé.</p>}
    <ul className="space-y-2">{rows.map(row => <li key={row.documentId}><Button type="button" variant="outline" className="h-auto whitespace-normal text-left" onClick={e => { trigger.current = e.currentTarget; setSelected(row); }}>{row.applicantName} · {row.roundName} · Review résumé</Button></li>)}</ul>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="flex h-[94dvh] max-w-[96vw] flex-col overflow-hidden sm:max-w-[96vw]" onCloseAutoFocus={e => { e.preventDefault(); (trigger.current?.isConnected ? trigger.current : refreshButton.current)?.focus(); }}>
      <DialogHeader className="pr-10"><DialogTitle>{selected?.applicantName} · Résumé</DialogTitle><DialogDescription>The document preserved for {selected?.roundName}. Moderated changes are audited.</DialogDescription></DialogHeader>
      <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setSelected(null)}>Close résumé</Button>
      {selected && scope && <Viewer scope={scope} documentId={selected.documentId} isDemo={isDemoEnabled} onAccessLost={() => { setRows([]); }} />}
    </DialogContent></Dialog>
  </section>;
}
