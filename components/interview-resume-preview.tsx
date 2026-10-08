"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InterviewResumeResource } from "@/lib/interview-resume-resource";
import { resumePreviewGesture } from "@/lib/resume-preview-gesture";

/** Shares the current authorized document's PDF; never obtains a caller-supplied URL. */
export default function InterviewResumePreview({ resource, name, onExpand, focusRef }: { resource: InterviewResumeResource; name: string; onExpand?: (page: number) => void; focusRef?: React.RefObject<HTMLDivElement | null> }) {
  const host = useRef<HTMLDivElement>(null), gesture = useMemo(resumePreviewGesture, []);
  const [error, setError] = useState(false), [ready, setReady] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => resource.subscribe(event => { if (event === "invalidated") { setReady(false); setRevision(v => v + 1); } }), [resource]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let current = true, generation = 0;
    let resize: ResizeObserver | undefined, observer: IntersectionObserver | undefined;
    const rendering = new Set<import("pdfjs-dist").RenderTask>();
    setError(false); setReady(false);
    void (async () => {
      const pdf = await resource.getPdf(), first = await pdf.getPage(1);
      if (!current) return;
      const firstViewport = first.getViewport({ scale: 1 });
      const sheets = Array.from({ length: pdf.numPages }, (_, index) => {
        const sheet = document.createElement("div"), canvas = document.createElement("canvas");
        sheet.className = "oc-resume-sheet"; sheet.dataset.page = String(index + 1);
        sheet.style.aspectRatio = `${firstViewport.width} / ${firstViewport.height}`;
        canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", `Résumé page ${index + 1} of ${pdf.numPages}`);
        const cached = resource.thumbnail(index + 1);
        if (cached) { canvas.width = cached.width; canvas.height = cached.height; canvas.getContext("2d")?.drawImage(cached, 0, 0); }
        sheet.append(canvas); return sheet;
      });
      element.replaceChildren(...sheets);
      const draw = async (sheet: HTMLDivElement, index: number, epoch: number) => {
        if (!current || epoch !== generation || sheet.dataset.rendered === String(epoch)) return;
        sheet.dataset.rendered = String(epoch);
        const page = index === 0 ? first : await pdf.getPage(index + 1);
        if (!current || epoch !== generation) return;
        const base = page.getViewport({ scale: 1 }), width = sheet.clientWidth;
        sheet.style.aspectRatio = `${base.width} / ${base.height}`;
        if (!width) { delete sheet.dataset.rendered; return; }
        const viewport = page.getViewport({ scale: width / base.width }), scale = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = sheet.firstElementChild as HTMLCanvasElement;
        canvas.width = Math.ceil(viewport.width * scale); canvas.height = Math.ceil(viewport.height * scale);
        const render = page.render({ canvas, viewport, transform: [scale, 0, 0, scale, 0, 0] });
        rendering.add(render);
        try {
          await render.promise;
          if (current && epoch === generation) { const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height; copy.getContext("2d")?.drawImage(canvas, 0, 0); resource.rememberThumbnail(index + 1, copy); }
        } catch { if (current && epoch === generation) setError(true); }
        finally { rendering.delete(render); }
      };
      const observe = () => {
        observer?.disconnect(); const epoch = ++generation;
        const previous = [...rendering]; previous.forEach(render => render.cancel());
        void Promise.allSettled(previous.map(render => render.promise)).then(() => {
          if (!current || epoch !== generation) return;
          observer = new IntersectionObserver(entries => {
            for (const entry of entries) if (entry.isIntersecting) void draw(entry.target as HTMLDivElement, sheets.indexOf(entry.target as HTMLDivElement), epoch);
          }, { root: element, rootMargin: "100px" });
          sheets.forEach(sheet => observer!.observe(sheet));
        });
      };
      let width = 0;
      resize = new ResizeObserver(() => { if (element.clientWidth !== width) { width = element.clientWidth; observe(); } });
      resize.observe(element); setReady(true);
    })().catch(() => { if (current) setError(true); });
    return () => { current = false; resize?.disconnect(); observer?.disconnect(); rendering.forEach(render => render.cancel()); element.replaceChildren(); };
  }, [resource, revision]);
  return <div className="oc-resume-mini">
    {!ready && !error && <p role="status">Loading résumé…</p>}
    {error && <p role="status">Preview unavailable. Use Expand résumé to view or download the document.</p>}
    <div ref={element => { host.current = element; if (focusRef) focusRef.current = element; }} className="oc-resume-preview" role="region" aria-label={`${name} résumé preview. Scroll to read all pages. Click to expand.`} tabIndex={0}
      onPointerDown={e => gesture.down(e, e.currentTarget)} onPointerMove={gesture.move} onPointerCancel={gesture.cancel} onWheel={gesture.cancel} onScroll={gesture.cancel}
      onPointerUp={e => gesture.up(e, e.currentTarget, !!window.getSelection()?.toString())}
      onClick={e => { if (onExpand && gesture.click()) onExpand(Number((e.target as HTMLElement).closest('[data-page]')?.getAttribute('data-page') || 1)); }} />
  </div>;
}
