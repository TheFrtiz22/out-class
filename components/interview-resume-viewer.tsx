"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { flushSync } from "react-dom";
import { resumeCommentInput } from "@/lib/resume-comment-input";
import { composerEnter } from "@/lib/composer-enter";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { InterviewScope } from "@/lib/interview-access";
import { annotationContentSchema } from "@/lib/interview-access";
import { anchorFromRange, anchorMatchesText, isAreaAnchor, isTextAnchor, rangeForText, type ResumeAnchor, type ResumeArea } from "@/lib/resume-anchors";
import { AreaHighlightMarks, AreaSelector } from "@/components/resume-area-highlights";
import { defaultArea, type AreaRect } from "@/lib/resume-area-geometry";
import { getInterviewResumeAnnotations, saveInterviewResumeAnnotation, deleteInterviewResumeAnnotation } from "@/lib/workspace-api";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { BoundingBox, ChevronLeft, ChevronRight, Download, StickyNote } from "@/components/icons";
import { useAuth } from "@/contexts/auth-context";
import { InterviewResumeResource, ResumeAccessError } from "@/lib/interview-resume-resource";
import { InterviewResumePlaceholder } from "@/components/interview-resume-placeholder";
import { NativeSelect } from "@/components/ui/native-select"

type Annotation = { id: string; revision: number; kind: "TEXT_HIGHLIGHT" | "AREA_HIGHLIGHT" | "GENERAL_NOTE"; comment: string; anchor: ResumeAnchor | ResumeArea | null; authorName: string; canEdit: boolean };
type Draft = { id: string; revision?: number; kind: Annotation["kind"]; comment: string; anchor: ResumeAnchor | ResumeArea | null };
/** An area being drawn or adjusted. `draftId` is set when adjusting the open draft's region. */
type AreaEdit = { page: number; rect: AreaRect; draftId?: string };
const areaLabel = (page: number) => `Area highlight · Page ${page}`;
const draftKind = (anchor: Draft["anchor"]): Draft["kind"] => isAreaAnchor(anchor) ? "AREA_HIGHLIGHT" : anchor ? "TEXT_HIGHLIGHT" : "GENERAL_NOTE";
type AreaProps = { area: AreaEdit | null; onStartArea: () => void; onAreaChange: (rect: AreaRect) => void; onAreaConfirm: (rect: AreaRect) => void; onAreaCancel: () => void };

function PdfPage({ pdf, resource, pageNumber, zoom, annotations, active, onAnchor, onComposedText, area, onStartArea, onAreaChange, onAreaConfirm, onAreaCancel }: { pdf: PDFDocumentProxy; resource: InterviewResumeResource; pageNumber: number; zoom: number; annotations: Annotation[]; active?: string; onAnchor: (anchor: ResumeAnchor, initialText?: string) => boolean; onComposedText: (text: string) => void } & AreaProps) {
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
  function capture(range?: Range, initialText = "") {
    const selection = window.getSelection();
    const selected = range || (selection?.rangeCount ? selection.getRangeAt(0) : null);
    if (!ready || area || !selected || !layer.current || !host.current || selected.collapsed) return false;
    const anchor = anchorFromRange(selected, layer.current, host.current, pageNumber);
    if (anchor) {
      // Snapshot the passage and clear the PDF selection BEFORE moving focus.
      // Clearing it afterward can also clear the new textarea's caret.
      const previous = selected.cloneRange();
      selection?.removeAllRanges();
      if (!onAnchor(anchor, initialText)) { selection?.addRange(previous); return false; }
      setError(""); return true;
    }
    else setError("Select text on a single page. Image-only content cannot be highlighted.");
    return false;
  }
  function findText() {
    if (!layer.current || !find.trim()) return;
    const start = text.indexOf(find);
    if (start < 0) { setError("That exact text was not found on this page."); return; }
    if (text.indexOf(find, start + 1) >= 0) { setError("That text appears more than once. Include more surrounding words or select it directly."); return; }
    const range = rangeForText(layer.current, start, start + find.length); if (range) capture(range);
  }
  return <div className="space-y-3" onKeyDownCapture={event => {
    const target = event.target as HTMLElement;
    const intent = resumeCommentInput({ ...event, key: event.key, isComposing: event.nativeEvent.isComposing, keyCode: event.nativeEvent.keyCode, altGraph: event.getModifierState("AltGraph") }, !!target.closest('input,textarea,select,button,a,[role="textbox"],[role="button"],[contenteditable="true"]'));
    if (!intent) return;
    if (capture(undefined, intent.text) && !intent.nativeComposition) { event.preventDefault(); event.stopPropagation(); }
  }} onPasteCapture={event => {
    const target = event.target as HTMLElement;
    if (target.closest('input,textarea,select,button,a,[role="textbox"],[role="button"],[contenteditable="true"]')) return;
    const text = event.clipboardData.getData("text/plain");
    if (text && capture(undefined, text)) { event.preventDefault(); event.stopPropagation(); }
  }} onCompositionStartCapture={event => {
    if (layer.current?.contains(event.target as Node)) capture();
  }} onCompositionEndCapture={event => {
    if (layer.current?.contains(event.target as Node) && event.data) onComposedText(event.data);
  }}>
    <p className="text-xs text-muted-foreground" role="status">{!ready ? "Rendering page…" : area ? "Drag on the page to draw an area, or drag the box and its corners. With the keyboard, use arrow keys to move and Shift with arrow keys to resize, then press Enter." : text.trim() ? "Select résumé text and type a comment, or choose Comment on selection." : "This scanned page has no selectable text. Add an area highlight to mark a region, or a general note."}</p>
    {ready && area ? <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => onAreaConfirm(area.rect)}>{area.draftId ? "Use this area" : "Add note to area"}</Button>
      <Button type="button" variant="outline" size="sm" onClick={onAreaCancel}>Cancel area</Button>
    </div> : ready && <div className="flex flex-wrap gap-2">
      {!!text.trim() && <>
      <Button type="button" variant="outline" size="sm" onPointerDown={e => e.preventDefault()} onClick={() => capture()}>Comment on selection</Button>
      <Input aria-label="Exact text to highlight on this page" value={find} onChange={e => setFind(e.target.value)} className="min-w-36 flex-1" onKeyDown={e => composerEnter(e, findText)} />
      <Button type="button" variant="outline" size="sm" onClick={findText}>Highlight this text</Button>
      </>}
      <Button type="button" variant="outline" size="sm" onClick={onStartArea}><BoundingBox className="size-4" aria-hidden="true" />Add area highlight</Button>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!ready && <InterviewResumePlaceholder resource={resource} page={pageNumber} />}
    <div className="overflow-auto rounded border bg-muted p-3" aria-label={`Résumé page ${pageNumber}`}>
      <div ref={host} className="oc-pdf-page mx-auto" data-pdf-ready={ready} style={{ minHeight: 100, display: ready ? undefined : "none" }}>
        <canvas ref={canvas} aria-label={`Rendered résumé page ${pageNumber}`} style={{ visibility: ready ? "visible" : "hidden" }} />
        {ready && annotations.flatMap(a => isTextAnchor(a.anchor) && a.anchor.page === pageNumber && anchorMatchesText(a.anchor, text, pdf.numPages) ? a.anchor.rectangles.map((r, i) => <div key={`${a.id}-${i}`} className="oc-pdf-highlight" data-active={a.id === active} aria-hidden="true" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` }} />) : [])}
        {ready && <AreaHighlightMarks active={active} areas={annotations.flatMap(a => isAreaAnchor(a.anchor) && a.anchor.page === pageNumber && a.id !== area?.draftId ? [{ id: a.id, rect: a.anchor.rect, label: `${areaLabel(pageNumber)} · ${a.authorName}` }] : [])} />}
        {ready && area?.page === pageNumber && <AreaSelector pageNumber={pageNumber} rect={area.rect} onChange={onAreaChange} onConfirm={onAreaConfirm} onCancel={onAreaCancel} />}
        <div ref={layer} tabIndex={0} role="document" className="oc-pdf-text" aria-label="Selectable résumé text" onPointerDown={event => { if (event.button === 0) layer.current?.focus({ preventScroll: true }); }} style={{ visibility: ready ? "visible" : "hidden" }} />
      </div>
    </div>
  </div>;
}

type ViewerProps = { scope: InterviewScope; documentId: string; isDemo: boolean; onAccessLost: () => void; resource?: InterviewResumeResource; initialPage?: number; preloadOnly?: boolean };
/** Warming loads code only; authorization and document state belong to the visible viewer. */
export default function InterviewResumeViewer(props: ViewerProps) {
  return props.preloadOnly ? null : <AuthorizedResumeViewer {...props} />;
}
function AuthorizedResumeViewer({ scope, documentId, isDemo, onAccessLost, resource: sharedResource, initialPage = 1 }: ViewerProps) {
  const { user } = useAuth();
  const confirm = useConfirm();
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
  const [areaEdit, setAreaEdit] = useState<AreaEdit | null>(null);
  const comment = useRef<HTMLTextAreaElement>(null), serial = useRef(0), mounted = useRef(true), writing = useRef(false), accessLost = useRef(onAccessLost);
  const refreshFlight = useRef<Promise<void> | null>(null);
  const savedFocus = useRef<string | null>(null), annotationNodes = useRef(new Map<string, HTMLLIElement>());
  accessLost.current = onAccessLost;
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches); update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const refresh = useCallback(async (afterWrite = false) => {
    // Slow authorized reads must finish before polling again. A completed write
    // invalidates that read and needs a fresh result before exposing its revision.
    if (refreshFlight.current) {
      await refreshFlight.current;
      if (!afterWrite || !mounted.current) return;
    }
    const sequence = ++serial.current;
    const flight = (async () => {
    try {
      const result = await getInterviewResumeAnnotations(request);
      if (!mounted.current || sequence !== serial.current) return;
      if (isDemo && "source" in result.document) setDemoSource(result.document.source === "/demo/sample-scanned-resume.pdf" ? "/demo/sample-scanned-resume.pdf" : "/demo/sample-resume.pdf");
      // A row this client cannot read is skipped, never treated as lost access.
      const rows = result.annotations.flatMap(a => { const content = annotationContentSchema.safeParse({ kind: a.kind, comment: a.comment, anchor: a.anchor }); return content.success ? [{ ...a, ...content.data }] : []; }) as Annotation[];
      setAnnotations(rows); setAuthorizedKey(resource.key); setAllowed(true); setStatus("Shared comments up to date");
    } catch {
      if (!mounted.current || sequence !== serial.current) return;
      setAllowed(false); setAnnotations([]); setDraft(null); setActive(undefined); setAreaEdit(null); resource.invalidate(); setStatus("Access could not be verified. Retry to check your membership and connection."); accessLost.current();
    }
    })();
    refreshFlight.current = flight;
    try { await flight; } finally { if (refreshFlight.current === flight) refreshFlight.current = null; }
  }, [request, isDemo, resource]);
  useEffect(() => { if (!sharedResource) return () => resource.invalidate(); }, [sharedResource, resource]);
  useEffect(() => {
    const sequenceRef = serial;
    mounted.current = true; void refresh();
    const poll = () => { if (!document.hidden && !writing.current) void refresh(); };
    const timer = setInterval(poll, 5000); window.addEventListener("focus", poll); document.addEventListener("visibilitychange", poll);
    return () => { mounted.current = false; ++sequenceRef.current; refreshFlight.current = null; clearInterval(timer); window.removeEventListener("focus", poll); document.removeEventListener("visibilitychange", poll); };
  }, [refresh]);
  useEffect(() => {
    if (!currentAccess) { setPdf(null); return; }
    let current = true;
    setPdfError(""); setPdf(null);
    (async () => {
      const document = await resource.getPdf(() => import("pdfjs-dist")); if (current) { setPage(p => Math.max(1, Math.min(document.numPages, p))); setPdf(document); }
    })().catch(error => { if (current) { if (error instanceof ResumeAccessError) { setAllowed(false); setAnnotations([]); setDraft(null); setActive(undefined); setAreaEdit(null); resource.invalidate(); setStatus("Access could not be verified. Retry to check your membership and connection."); accessLost.current(); } setPdfError("Text viewing is unavailable for this PDF. It may be encrypted, damaged or unsupported. You can retry or download the original and keep general résumé notes."); } });
    return () => { current = false; };
  }, [currentAccess, resource, retry]);
  const draftId = draft?.id;
  useLayoutEffect(() => {
    if (draft || !savedFocus.current) return;
    const node = annotationNodes.current.get(savedFocus.current);
    if (node) { node.focus({ preventScroll: false }); savedFocus.current = null; }
  }, [annotations, draft]);
  useLayoutEffect(() => {
    if (!draftId || !comment.current) return;
    const field = comment.current;
    field.focus({ preventScroll: false });
    field.setSelectionRange(field.value.length, field.value.length);
  }, [draftId]); // Only a new/edit composer takes focus; polling and typing never do.

  function begin(anchor: Draft["anchor"], initialText = "") {
    if (writing.current || !currentAccess) return false;
    if (draft) {
      // Ask first; the composer opens only after the reader chooses to discard.
      void confirm({ title: "Discard the unsaved comment?", description: "Your unsaved résumé comment will be lost.", confirmLabel: "Discard comment", cancelLabel: "Keep editing", tone: "danger" }).then(ok => { if (ok && !writing.current) startDraft(anchor, initialText); });
      return false;
    }
    return startDraft(anchor, initialText);
  }
  function startDraft(anchor: Draft["anchor"], initialText: string) {
    // Focus must exist before the browser's next input/composition event. The
    // first printable key is seeded once rather than replaying synthetic keys.
    flushSync(() => { setDraft({ id: crypto.randomUUID(), kind: draftKind(anchor), comment: initialText, anchor }); setNotesOpen(true); setMobileTab("comments"); setError(""); });
    return true;
  }
  /** Keyboard, mouse and touch all start from the same default region on the current page. */
  function startArea() {
    if (writing.current || !currentAccess) return;
    const open = () => { setDraft(null); setError(""); setActive(undefined); setAreaEdit({ page, rect: defaultArea }); setMobileTab("document"); };
    if (!draft) { open(); return; }
    void confirm({ title: "Discard the unsaved comment?", description: "Your unsaved résumé comment will be lost.", confirmLabel: "Discard comment", cancelLabel: "Keep editing", tone: "danger" }).then(ok => { if (ok && !writing.current) open(); });
  }
  function confirmArea(rect: AreaRect) {
    const edit = areaEdit; if (!edit) return;
    const anchor: ResumeArea = { page: edit.page, rect };
    setAreaEdit(null);
    if (edit.draftId) { setDraft(d => d && d.id === edit.draftId ? { ...d, anchor } : d); setNotesOpen(true); setMobileTab("comments"); requestAnimationFrame(() => comment.current?.focus()); }
    else startDraft(anchor, "");
  }
  function adjustArea() {
    if (!draft || !isAreaAnchor(draft.anchor)) return;
    setPage(draft.anchor.page); setAreaEdit({ page: draft.anchor.page, rect: draft.anchor.rect, draftId: draft.id }); setMobileTab("document");
  }
  function cancelArea() {
    setAreaEdit(null);
    if (draft && isAreaAnchor(draft.anchor)) { setMobileTab("comments"); requestAnimationFrame(() => comment.current?.focus()); }
  }
  async function save() {
    if (!draft || writing.current || !currentAccess || conflict || areaEdit) return;
    const content = annotationContentSchema.safeParse({ kind: draft.kind, comment: draft.comment, anchor: draft.anchor });
    if (!content.success) { setError("Enter a comment of 1–10,000 characters."); return; }
    writing.current = true; ++serial.current; setBusy(true); setError(""); setStatus("Saving comment…");
    try {
      await saveInterviewResumeAnnotation({ ...request, id: draft.id, ...(draft.revision !== undefined ? { revision: draft.revision } : {}), content: content.data });
      if (mounted.current) { savedFocus.current = draft.id; setActive(draft.id); setDraft(null); setStatus("Comment saved"); await refresh(true); }
    } catch {
      if (mounted.current) { setError("Comment was not saved. Your text is retained. Retry, or review the latest version if someone changed it."); await refresh(true); }
    } finally { writing.current = false; if (mounted.current) setBusy(false); }
  }
  async function remove(a: Annotation) {
    if (writing.current || !(await confirm({ title: `Delete this comment by ${a.authorName}?`, description: "Moderation history is retained.", confirmLabel: "Delete comment", tone: "danger" })) || writing.current) return;
    writing.current = true; ++serial.current; setBusy(true); setError("");
    try { await deleteInterviewResumeAnnotation({ ...request, id: a.id, revision: a.revision }); if (draft?.id === a.id) setDraft(null); await refresh(true); }
    catch { setError("Comment was not deleted. Refresh and review its latest version before retrying."); await refresh(true); }
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
  return <div className="flex min-h-0 flex-1 flex-col gap-3" onKeyDownCapture={event => {
    if (event.key !== "Escape" || !draft || areaEdit || busy || event.nativeEvent.isComposing) return;
    event.preventDefault(); event.stopPropagation(); setDraft(null); setError("");
    comment.current?.closest<HTMLElement>("aside")?.focus({ preventScroll: true });
  }}>
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="ghost" size="sm" className="h-9 px-2" disabled={!currentAccess} onClick={download} aria-label="Download original PDF"><Download className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Download</span></Button>
      {currentAccess && pdf && <>
        {pdf.numPages > 1 && <>
        <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
        <label className="flex items-center gap-1 text-sm">Page <NativeSelect aria-label="Résumé page"  value={page} onChange={e => setPage(Number(e.target.value))}>{Array.from({ length: pdf.numPages }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</NativeSelect> of {pdf.numPages}</label>
        <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Next page" disabled={page >= pdf.numPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4" aria-hidden="true" /></Button>
        </>}
        <label className="flex items-center gap-1 text-sm">Zoom <NativeSelect aria-label="Résumé zoom"  value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map(z => <option key={z} value={z}>{z * 100}%</option>)}</NativeSelect></label>
      </>}
      <Button type="button" variant="ghost" size="sm" className="ml-auto h-9 px-2" aria-label="General résumé notes" aria-controls="resume-comments" aria-expanded={desktop ? notesOpen : mobileTab === "comments"} onClick={() => { if (desktop) setNotesOpen(v => !v); else { setMobileTab("comments"); setNotesOpen(true); } }}><StickyNote className="size-4" aria-hidden="true" /><span className="hidden sm:inline">General résumé notes</span></Button>
    </div>
    <div className="lg:hidden"><SegmentedControl label="Résumé view" value={mobileTab} onChange={tab => { setMobileTab(tab); if (tab === "comments") setNotesOpen(true); }} options={[{ value: "document", label: "Document" }, { value: "comments", label: `Panel comments (${currentAccess ? annotations.length : 0})` }]} /></div>
    <p className="text-xs text-muted-foreground" role="status" aria-live="polite">{status}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!currentAccess ? <>{status.startsWith("Access could") ? <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>Retry access</Button> : <div className="min-h-0 overflow-auto"><InterviewResumePlaceholder resource={resource} page={page} /></div>}</> : <div className={`grid min-h-0 flex-1 gap-4 overflow-auto ${notesOpen ? "lg:grid-cols-[minmax(0,1fr)_20rem]" : ""}`}>
      <div className={`min-w-0 overflow-auto ${mobileTab === "document" ? "" : "hidden lg:block"}`}>
        {pdf ? <PdfPage pdf={pdf} resource={resource} pageNumber={page} zoom={zoom} annotations={draft?.anchor ? [...annotations.filter(a => a.id !== draft.id), { ...draft, revision: draft.revision ?? 0, authorName: "Unsaved comment", canEdit: true }] : annotations} active={draft?.anchor ? draft.id : active} onAnchor={begin} onComposedText={text => setDraft(d => d?.anchor && !d.comment ? { ...d, comment: text } : d)}
          area={areaEdit?.page === page ? areaEdit : null} onStartArea={startArea} onAreaChange={rect => setAreaEdit(e => e && { ...e, rect })} onAreaConfirm={confirmArea} onAreaCancel={cancelArea} /> : <div><p role="status" className="p-3 text-sm">{pdfError || "Loading saved document…"}</p>{pdfError && <Button type="button" variant="outline" size="sm" onClick={() => { resource.invalidate(); void refresh(); setRetry(v => v + 1); }}>Retry document</Button>}</div>}
      </div>
      <aside id="resume-comments" tabIndex={-1} className={`space-y-4 overflow-auto rounded-lg border p-3 ${mobileTab === "comments" ? "" : "hidden lg:block"} ${notesOpen ? "" : "lg:hidden"}`} aria-label="Shared résumé comments">
        <h3 className="font-medium">Panel résumé comments</h3>
        <p className="text-xs text-muted-foreground">Shared with the authorized panel and president/vice-president moderators. Question notes remain private.</p>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => begin(null)}>Add general résumé note</Button>
        {draft && <div data-resume-comment-draft className="space-y-2 rounded border bg-muted/30 p-3">
          {isTextAnchor(draft.anchor) && <blockquote className="break-words text-xs">Page {draft.anchor.page}: “{draft.anchor.quote}”</blockquote>}
          {isAreaAnchor(draft.anchor) && <div className="flex flex-wrap items-center gap-2 text-xs"><span className="inline-flex items-center gap-1 font-medium"><BoundingBox className="size-4" aria-hidden="true" />{areaLabel(draft.anchor.page)}</span><Button type="button" variant="outline" size="sm" disabled={busy || !!areaEdit} onClick={adjustArea}>Move or resize area</Button></div>}
          <label htmlFor="resume-comment" className="text-sm font-medium">{isAreaAnchor(draft.anchor) ? "Area highlight note" : draft.anchor ? "Highlight comment" : "General résumé note"}</label>
          <Textarea ref={comment} id="resume-comment" value={draft.comment} maxLength={10000} disabled={busy} aria-describedby="resume-comment-keyboard" onKeyDown={e => composerEnter(e, save)} onChange={e => setDraft(d => d && ({ ...d, comment: e.target.value }))} />
          <p id="resume-comment-keyboard" className="text-xs text-muted-foreground">Enter to save comment · Shift+Enter for a new line</p>
          {conflict && <div role="alert" className="space-y-2 text-sm"><p>This comment changed or your editing access changed. Your draft has been retained.</p>{latest?.canEdit && <><p className="whitespace-pre-wrap break-words">Latest: {latest.comment}</p><Button type="button" variant="outline" size="sm" onClick={() => setDraft(d => d && ({ ...d, revision: latest.revision }))}>Use latest revision with my draft</Button></>}</div>}
          <div className="flex gap-2"><Button type="button" size="sm" disabled={busy || conflict || !!areaEdit} onClick={save}>{busy ? "Saving…" : "Save comment"}</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setDraft(null); setAreaEdit(null); }}>Cancel comment</Button></div>
        </div>}
        {!annotations.length && <p className="text-sm text-muted-foreground">No shared comments yet.</p>}
        <ul className="space-y-3">{annotations.map(a => <li key={a.id} ref={node => { if (node) annotationNodes.current.set(a.id, node); else annotationNodes.current.delete(a.id); }} tabIndex={-1} className={`space-y-2 rounded border p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${active === a.id ? "border-primary bg-accent/30" : ""}`}>
          <p className="text-sm font-medium">{a.authorName}</p>
          {isTextAnchor(a.anchor) ? <Button type="button" variant="ghost" className="h-auto max-w-full justify-start whitespace-normal break-words px-0 text-left text-control" onClick={() => { setPage(a.anchor!.page); setActive(a.id); setMobileTab("document"); }}>Page {a.anchor.page}: “{a.anchor.quote}”</Button>
            : isAreaAnchor(a.anchor) ? <Button type="button" variant="ghost" className="h-auto max-w-full justify-start gap-1 whitespace-normal px-0 text-left text-control" data-area-highlight={a.id} onClick={() => { setPage(a.anchor!.page); setActive(a.id); setMobileTab("document"); }}><BoundingBox className="size-4" aria-hidden="true" />{areaLabel(a.anchor.page)}</Button>
            : <p className="text-xs text-muted-foreground">General résumé note</p>}
          <p className="whitespace-pre-wrap break-words text-sm">{a.comment}</p>
          {a.canEdit && <div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={async () => { if (!draft || await confirm({ title: "Discard the unsaved comment?", description: "Your unsaved résumé comment will be lost.", confirmLabel: "Discard comment", cancelLabel: "Keep editing", tone: "danger" })) { setDraft({ id: a.id, revision: a.revision, kind: a.kind, comment: a.comment, anchor: a.anchor }); setAreaEdit(null); setError(""); } }}>Edit</Button><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove(a)}>Delete</Button></div>}
        </li>)}</ul>
      </aside>
    </div>}
  </div>;
}
