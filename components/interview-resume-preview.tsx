"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

/** Uses only the blob already obtained through authorized document access. */
export default function InterviewResumePreview({ url, name }: { url: string; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false), [ready, setReady] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const abort = new AbortController();
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    let pdf: PDFDocumentProxy | undefined;
    let resize: ResizeObserver | undefined, observer: IntersectionObserver | undefined;
    const rendering = new Set<import("pdfjs-dist").RenderTask>();
    let generation = 0;
    setError(false); setReady(false);
    void (async () => {
      const response = await fetch(url, { signal: abort.signal });
      const data = new Uint8Array(await response.arrayBuffer());
      const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
      if (abort.signal.aborted) return;
      GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      task = getDocument({ data, cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/", iccUrl: "/pdfjs/iccs/" });
      pdf = await task.promise;
      const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_, index) => pdf!.getPage(index + 1)));
      if (abort.signal.aborted) return;
      const sheets = pages.map((page, index) => {
        const sheet = document.createElement("div"), canvas = document.createElement("canvas");
        const viewport = page.getViewport({ scale: 1 });
        sheet.className = "oc-resume-sheet";
        sheet.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
        canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", `Résumé page ${index + 1} of ${pages.length}`);
        sheet.append(canvas); return sheet;
      });
      element.replaceChildren(...sheets);
      const draw = async (sheet: HTMLDivElement, index: number, epoch: number) => {
        if (abort.signal.aborted || epoch !== generation || sheet.dataset.rendered === String(epoch)) return;
        sheet.dataset.rendered = String(epoch);
        const page = pages[index], base = page.getViewport({ scale: 1 });
        const width = sheet.clientWidth;
        if (!width) { delete sheet.dataset.rendered; return; }
        const viewport = page.getViewport({ scale: width / base.width });
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = sheet.firstElementChild as HTMLCanvasElement;
        canvas.width = Math.ceil(viewport.width * scale); canvas.height = Math.ceil(viewport.height * scale);
        const render = page.render({ canvas, viewport, transform: [scale, 0, 0, scale, 0, 0] });
        rendering.add(render);
        try { await render.promise; } catch { if (!abort.signal.aborted && epoch === generation) setError(true); }
        finally { rendering.delete(render); }
      };
      const observe = () => {
        observer?.disconnect(); const epoch = ++generation;
        // Wait for cancelled renders before reusing their canvases on resize.
        const previous = [...rendering]; previous.forEach(render => render.cancel());
        void Promise.allSettled(previous.map(render => render.promise)).then(() => {
          if (abort.signal.aborted || epoch !== generation) return;
          observer = new IntersectionObserver(entries => {
            for (const entry of entries) if (entry.isIntersecting) void draw(entry.target as HTMLDivElement, sheets.indexOf(entry.target as HTMLDivElement), epoch);
          }, { root: element, rootMargin: "250px" });
          sheets.forEach(sheet => observer!.observe(sheet));
        });
      };
      let width = 0;
      resize = new ResizeObserver(() => { if (element.clientWidth !== width) { width = element.clientWidth; observe(); } });
      resize.observe(element); setReady(true);
    })().catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => {
      abort.abort(); resize?.disconnect(); observer?.disconnect(); rendering.forEach(render => render.cancel());
      if (task) void task.destroy(); element.replaceChildren();
    };
  }, [url]);
  return <div className="oc-resume-mini">
    {!ready && !error && <p role="status">Loading résumé…</p>}
    {error && <p role="status">Preview unavailable. Use Expand résumé to view or download the document.</p>}
    <div ref={host} className="oc-resume-preview" role="region" aria-label={`${name} résumé preview. Scroll to read all pages.`} tabIndex={0} />
  </div>;
}
