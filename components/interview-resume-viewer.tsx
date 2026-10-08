"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { InterviewScope } from "@/lib/interview-access";
import { annotationContentSchema } from "@/lib/interview-access";
import { anchorFromRange, anchorMatchesText, rangeForText, type ResumeAnchor } from "@/lib/resume-anchors";
import { getInterviewResumeAnnotations, saveInterviewResumeAnnotation, deleteInterviewResumeAnnotation } from "@/lib/workspace-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Download, StickyNote } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { InterviewResumeResource, ResumeAccessError } from "@/lib/interview-resume-resource";
import { InterviewResumePlaceholder } from "@/components/interview-resume-placeholder";

type Annotation = { id: string; revision: number; kind: "TEXT_HIGHLIGHT" | "GENERAL_NOTE"; comment: string; anchor: ResumeAnchor | null; authorName: string; canEdit: boolean };
type Draft = { id: string; revision?: number; kind: Annotation["kind"]; comment: string; anchor: ResumeAnchor | null };

function PdfPage({ pdf, resource, pageNumber, zoom, annotations, active, onAnchor }: { pdf: PDFDocumentProxy; resource: InterviewResumeResource; pageNumber: number; zoom: number; annotations: Annotation[]; active?: string; onAnchor: (anchor: ResumeAnchor) => void }) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), layer = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false), [text, setText] = useState(""), [error, setError] = useState(""), [find, setFind] = useState("");
  useEffect(() => {
    let current = true; let cancel = () => {};
    setReady(false); setText(""); setError("");
    (async () => {
      const cached = resource.currentFrame(pageNumber, zoom);
      if (cached && host.current && canvas.current && layer.current) {
        host.current.style.width = `${cached.width}px`; host.current.style.height = `${cached.height}px`; host.current.style.setProperty("--total-scale-factor", String(zoom));
        canvas.current.width = cached.canvas.width; canvas.current.height = cached.canvas.height;
        canvas.current.style.width = `${cached.width}px`; canvas.current.style.height = `${cached.height}px`;
        canvas.current.getContext("2d")?.drawImage(cached.canvas, 0, 0);
        layer.current.replaceChildren(...cached.textNodes.map(node => node.cloneNode(true)));
        setText(cached.text); setReady(true); return;
      }
      const { TextLayer } = await import("pdfjs-dist");
      const page = await pdf.getPage(pageNumber), viewport = page.getViewport({ scale: zoom });
      if (!current || !host.current || !canvas.current || !layer.current) return;
      const element = host.current, surface = canvas.current, textHost = layer.current;
      element.style.width = `${viewport.width}px`; element.style.height = `${viewport.height}px`;
      element.style.setProperty("--total-scale-factor", String(zoom));
      const outputScale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(12000000 / (viewport.width * viewport.height)));
      surface.width = Math.floor(viewport.width * outputScale); surface.height = Math.floor(viewport.height * outputScale);
      surface.style.width = `${viewport.width}px`; surface.style.height = `${viewport.height}px`;
      textHost.replaceChildren();
      const rendering = page.render({ canvas: surface, viewport, transform: [outputScale, 0, 0, outputScale, 0, 0] });
      cancel = () => rendering.cancel();
      const [, content] = await Promise.all([rendering.promise, page.getTextContent()]); if (!current) return;
      const textLayer = new TextLayer({ textContentSource: content, container: textHost, viewport });
      cancel = () => { rendering.cancel(); textLayer.cancel(); };
      await Promise.all([rendering.promise, textLayer.render()]);
      if (current) {
        const text = textHost.textContent || "", copy = document.createElement("canvas");
        copy.width = surface.width; copy.height = surface.height; copy.getContext("2d")?.drawImage(surface, 0, 0);
        resource.rememberFrame({ page: pageNumber, zoom, width: viewport.width, height: viewport.height, canvas: copy, textNodes: [...textHost.childNodes].map(node => node.cloneNode(true)), text });
        setText(text); setReady(true);
      }
    })().catch(() => { if (current) setError("This page could not be rendered. Try another page or download the original PDF."); });
    return () => { current = false; cancel(); };
  }, [pdf, resource, pageNumber, zoom]);
  function capture(range?: Range) {
    const selection = window.getSelection();
    const selected = range || (selection?.rangeCount ? selection.getRangeAt(0) : null);
    if (!ready || !selected || !layer.current || !host.current) return;
    const anchor = anchorFromRange(selected, layer.current, host.current, pageNumber);
    if (anchor) { onAnchor(anchor); selection?.removeAllRanges(); setError(""); }
    else setError("Select text on a single page. Image-only content cannot be highlighted.");
  }
  function findText() {
    if (!layer.current || !find.trim()) return;
    const start = text.indexOf(find);
    if (start < 0) { setError("That exact text was not found on this page."); return; }
    if (text.indexOf(find, start + 1) >= 0) { setError("That text appears more than once. Include more surrounding words or select it directly."); return; }
    const range = rangeForText(layer.current, start, start + find.length); if (range) capture(range);
  }
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground" role="status">{ready ? text.trim() ? "Select text on this page, then choose Comment on selection. You can also find exact text below." : "Text highlighting is unavailable on this image-only page. General résumé notes and download are still available. No OCR is used." : "Rendering page…"}</p>
    {!!text.trim() && <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onPointerDown={e => e.preventDefault()} onClick={() => capture()}>Comment on selection</Button>
      <Input aria-label="Exact text to highlight on this page" value={find} onChange={e => setFind(e.target.value)} className="min-w-36 flex-1" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); findText(); } }} />
      <Button type="button" variant="outline" size="sm" onClick={findText}>Highlight this text</Button>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!ready && <InterviewResumePlaceholder resource={resource} page={pageNumber} />}
    <div className="overflow-auto rounded border bg-muted p-3" aria-label={`Résumé page ${pageNumber}`}>
      <div ref={host} className="oc-pdf-page mx-auto" data-pdf-ready={ready} style={{ minHeight: 100, display: ready ? undefined : "none" }}>
        <canvas ref={canvas} aria-label={`Rendered résumé page ${pageNumber}`} style={{ visibility: ready ? "visible" : "hidden" }} />
        {ready && annotations.filter(a => a.anchor?.page === pageNumber && anchorMatchesText(a.anchor, text, pdf.numPages)).flatMap(a => a.anchor!.rectangles.map((r, i) => <div key={`${a.id}-${i}`} className="oc-pdf-highlight" data-active={a.id === active} aria-hidden="true" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` }} />))}
        <div ref={layer} className="oc-pdf-text" aria-label="Selectable résumé text" style={{ visibility: ready ? "visible" : "hidden" }} />
      </div>
    </div>
  </div>;
}

export default function InterviewResumeViewer({ scope, documentId, isDemo, onAccessLost, resource: sharedResource, initialPage = 1 }: { scope: InterviewScope; documentId: string; isDemo: boolean; onAccessLost: () => void; resource?: InterviewResumeResource; initialPage?: number }) {
  const { user } = useAuth();
  const request = useMemo(() => ({ ...scope, documentId }), [scope, documentId]);
  const [demoSource, setDemoSource] = useState("/demo/sample-resume.pdf");
  const path = isDemo ? demoSource : `/api/interview-resumes?${new URLSearchParams(request)}`;
  const resource = useMemo(() => sharedResource || new InterviewResumeResource(user?.id || "", scope, documentId, isDemo, demoSource), [sharedResource, user?.id, scope, documentId, isDemo, demoSource]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]), [allowed, setAllowed] = useState(false), [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [authorizedKey, setAuthorizedKey] = useState("");
  const currentAccess = allowed && authorizedKey === resource.key;
  const [pdfError, setPdfError] = useState(""), [error, setError] = useState(""), [status, setStatus] = useState("Checking current access…"), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null), [active, setActive] = useState<string>(), [page, setPage] = useState(initialPage), [zoom, setZoom] = useState(1), [notesOpen, setNotesOpen] = useState(true), [retry, setRetry] = useState(0);
  const [mobileTab, setMobileTab] = useState<"document" | "comments">("document"), [desktop, setDesktop] = useState(false);
  const comment = useRef<HTMLTextAreaElement>(null), serial = useRef(0), mounted = useRef(true), writing = useRef(false), accessLost = useRef(onAccessLost);
  accessLost.current = onAccessLost;
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches); update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const refresh = useCallback(async () => {
    const sequence = ++serial.current;
    try {
      const result = await getInterviewResumeAnnotations(request);
      if (!mounted.current || sequence !== serial.current) return;
      if (isDemo && "source" in result.document) setDemoSource(result.document.source === "/demo/sample-scanned-resume.pdf" ? "/demo/sample-scanned-resume.pdf" : "/demo/sample-resume.pdf");
      const rows = result.annotations.map(a => ({ ...a, ...annotationContentSchema.parse({ kind: a.kind, comment: a.comment, anchor: a.anchor }) })) as Annotation[];
      setAnnotations(rows); setAuthorizedKey(resource.key); setAllowed(true); setStatus("Shared comments up to date");
    } catch {
      if (!mounted.current || sequence !== serial.current) return;
      setAllowed(false); setAnnotations([]); setDraft(null); setActive(undefined); resource.invalidate(); setStatus("Access could not be verified. Retry to check your membership and connection."); accessLost.current();
    }
  }, [request, isDemo, resource]);
  useEffect(() => { if (!sharedResource) return () => resource.invalidate(); }, [sharedResource, resource]);
  useEffect(() => {
    const sequenceRef = serial;
    mounted.current = true; void refresh();
    const poll = () => { if (!document.hidden && !writing.current) void refresh(); };
    const timer = setInterval(poll, 5000); window.addEventListener("focus", poll); document.addEventListener("visibilitychange", poll);
    return () => { mounted.current = false; ++sequenceRef.current; clearInterval(timer); window.removeEventListener("focus", poll); document.removeEventListener("visibilitychange", poll); };
  }, [refresh]);
  useEffect(() => {
    if (!currentAccess) { setPdf(null); return; }
    let current = true;
    setPdfError(""); setPdf(null);
    (async () => {
      const document = await resource.getPdf(); if (current) { setPage(p => Math.max(1, Math.min(document.numPages, p))); setPdf(document); }
    })().catch(error => { if (current) { if (error instanceof ResumeAccessError) { setAllowed(false); setAnnotations([]); setDraft(null); setActive(undefined); resource.invalidate(); setStatus("Access could not be verified. Retry to check your membership and connection."); accessLost.current(); } setPdfError("Text viewing is unavailable for this PDF. It may be encrypted, damaged or unsupported. You can retry or download the original and keep general résumé notes."); } });
    return () => { current = false; };
  }, [currentAccess, resource, retry]);
  const draftId = draft?.id;
  useEffect(() => { if (draftId) comment.current?.focus(); }, [draftId]); // Keep typing focus during refreshes.

  function begin(anchor: ResumeAnchor | null) {
    if (writing.current) return;
    if (draft && !window.confirm("Discard the unsaved résumé comment?")) return;
    setDraft({ id: crypto.randomUUID(), kind: anchor ? "TEXT_HIGHLIGHT" : "GENERAL_NOTE", comment: "", anchor }); setNotesOpen(true); setMobileTab("comments"); setError("");
  }
  async function save() {
    if (!draft || writing.current) return;
    const content = annotationContentSchema.safeParse({ kind: draft.kind, comment: draft.comment, anchor: draft.anchor });
    if (!content.success) { setError("Enter a comment of 1–10,000 characters."); return; }
    writing.current = true; ++serial.current; setBusy(true); setError(""); setStatus("Saving comment…");
    try {
      await saveInterviewResumeAnnotation({ ...request, id: draft.id, ...(draft.revision !== undefined ? { revision: draft.revision } : {}), content: content.data });
      if (mounted.current) { setDraft(null); setStatus("Comment saved"); await refresh(); }
    } catch {
      if (mounted.current) { setError("Comment was not saved. Your text is retained. Retry, or review the latest version if someone changed it."); await refresh(); }
    } finally { writing.current = false; if (mounted.current) setBusy(false); }
  }
  async function remove(a: Annotation) {
    if (writing.current || !window.confirm(`Delete this résumé comment by ${a.authorName}? Moderation history is retained.`)) return;
    writing.current = true; ++serial.current; setBusy(true); setError("");
    try { await deleteInterviewResumeAnnotation({ ...request, id: a.id, revision: a.revision }); if (draft?.id === a.id) setDraft(null); await refresh(); }
    catch { setError("Comment was not deleted. Refresh and review its latest version before retrying."); await refresh(); }
    finally { writing.current = false; if (mounted.current) setBusy(false); }
  }
  async function download() {
    if (writing.current) return;
    setError("");
    try {
      await getInterviewResumeAnnotations(request); // Demo access too; never bypass membership on a cached blob.
      const response = await fetch(path, { cache: "no-store" }); if (!response.ok) throw new Error("Unavailable");
      const blob = await response.blob(); if (!mounted.current) return;
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = "interview-resume.pdf"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Download unavailable. Check your current access and retry."); await refresh(); }
  }
  const latest = draft?.revision !== undefined ? annotations.find(a => a.id === draft.id) : undefined;
  const conflict = !!draft && draft.revision !== undefined && (!latest || latest.revision !== draft.revision || !latest.canEdit);
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="ghost" size="sm" className="h-9 px-2" disabled={!currentAccess} onClick={download} aria-label="Download original PDF"><Download className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Download</span></Button>
      {currentAccess && pdf && <>
        {pdf.numPages > 1 && <>
        <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
        <label className="flex items-center gap-1 text-sm">Page <select aria-label="Résumé page" className="rounded border bg-background p-1" value={page} onChange={e => setPage(Number(e.target.value))}>{Array.from({ length: pdf.numPages }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select> of {pdf.numPages}</label>
        <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Next page" disabled={page >= pdf.numPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4" aria-hidden="true" /></Button>
        </>}
        <label className="flex items-center gap-1 text-sm">Zoom <select aria-label="Résumé zoom" className="rounded border bg-background p-1" value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map(z => <option key={z} value={z}>{z * 100}%</option>)}</select></label>
      </>}
      <Button type="button" variant="ghost" size="sm" className="ml-auto h-9 px-2" aria-label="General résumé notes" aria-controls="resume-comments" aria-expanded={desktop ? notesOpen : mobileTab === "comments"} onClick={() => { if (desktop) setNotesOpen(v => !v); else { setMobileTab("comments"); setNotesOpen(true); } }}><StickyNote className="size-4" aria-hidden="true" /><span className="hidden sm:inline">General résumé notes</span></Button>
    </div>
    <div role="group" aria-label="Résumé view" className="flex gap-2 lg:hidden"><Button type="button" variant={mobileTab === "document" ? "default" : "outline"} size="sm" aria-pressed={mobileTab === "document"} onClick={() => setMobileTab("document")}>Document</Button><Button type="button" variant={mobileTab === "comments" ? "default" : "outline"} size="sm" aria-pressed={mobileTab === "comments"} onClick={() => { setMobileTab("comments"); setNotesOpen(true); }}>Panel comments ({currentAccess ? annotations.length : 0})</Button></div>
    <p className="text-xs text-muted-foreground" role="status" aria-live="polite">{status}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!currentAccess ? <>{status.startsWith("Access could") ? <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>Retry access</Button> : <div className="min-h-0 overflow-auto"><InterviewResumePlaceholder resource={resource} page={page} /></div>}</> : <div className={`grid min-h-0 flex-1 gap-4 overflow-auto ${notesOpen ? "lg:grid-cols-[minmax(0,1fr)_20rem]" : ""}`}>
      <div className={`min-w-0 overflow-auto ${mobileTab === "document" ? "" : "hidden lg:block"}`}>
        {pdf ? <PdfPage pdf={pdf} resource={resource} pageNumber={page} zoom={zoom} annotations={draft?.anchor ? [...annotations.filter(a => a.id !== draft.id), { ...draft, revision: draft.revision ?? 0, authorName: "Unsaved comment", canEdit: true }] : annotations} active={draft?.anchor ? draft.id : active} onAnchor={begin} /> : <div><p role="status" className="p-3 text-sm">{pdfError || "Loading saved document…"}</p>{pdfError && <Button type="button" variant="outline" size="sm" onClick={() => { resource.invalidate(); void refresh(); setRetry(v => v + 1); }}>Retry document</Button>}</div>}
      </div>
      <aside id="resume-comments" className={`space-y-4 overflow-auto rounded-lg border p-3 ${mobileTab === "comments" ? "" : "hidden lg:block"} ${notesOpen ? "" : "lg:hidden"}`} aria-label="Shared résumé comments">
        <h3 className="font-medium">Panel résumé comments</h3>
        <p className="text-xs text-muted-foreground">Shared with the authorized panel and president/vice-president moderators. Question notes remain private.</p>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => begin(null)}>Add general résumé note</Button>
        {draft && <div className="space-y-2 rounded border bg-muted/30 p-3">
          {draft.anchor && <blockquote className="break-words text-xs">Page {draft.anchor.page}: “{draft.anchor.quote}”</blockquote>}
          <label htmlFor="resume-comment" className="text-sm font-medium">{draft.anchor ? "Highlight comment" : "General résumé note"}</label>
          <Textarea ref={comment} id="resume-comment" value={draft.comment} maxLength={10000} disabled={busy} onChange={e => setDraft(d => d && ({ ...d, comment: e.target.value }))} />
          {conflict && <div role="alert" className="space-y-2 text-sm"><p>This comment changed or your editing access changed. Your draft has been retained.</p>{latest?.canEdit && <><p className="whitespace-pre-wrap break-words">Latest: {latest.comment}</p><Button type="button" variant="outline" size="sm" onClick={() => setDraft(d => d && ({ ...d, revision: latest.revision }))}>Use latest revision with my draft</Button></>}</div>}
          <div className="flex gap-2"><Button type="button" size="sm" disabled={busy || conflict} onClick={save}>{busy ? "Saving…" : "Save comment"}</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setDraft(null)}>Cancel comment</Button></div>
        </div>}
        {!annotations.length && <p className="text-sm text-muted-foreground">No shared comments yet.</p>}
        <ul className="space-y-3">{annotations.map(a => <li key={a.id} className={`space-y-2 rounded border p-3 ${active === a.id ? "border-primary bg-accent/30" : ""}`}>
          <p className="text-sm font-medium">{a.authorName}</p>
          {a.anchor ? <Button type="button" variant="ghost" className="h-auto max-w-full justify-start whitespace-normal break-words px-0 text-left text-xs" onClick={() => { setPage(a.anchor!.page); setActive(a.id); setMobileTab("document"); }}>Page {a.anchor.page}: “{a.anchor.quote}”</Button> : <p className="text-xs text-muted-foreground">General résumé note</p>}
          <p className="whitespace-pre-wrap break-words text-sm">{a.comment}</p>
          {a.canEdit && <div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { if (!draft || window.confirm("Discard the unsaved résumé comment?")) { setDraft({ id: a.id, revision: a.revision, kind: a.kind, comment: a.comment, anchor: a.anchor }); setError(""); } }}>Edit</Button><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove(a)}>Delete</Button></div>}
        </li>)}</ul>
      </aside>
    </div>}
  </div>;
}
