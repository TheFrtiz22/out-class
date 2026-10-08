import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { InterviewScope } from "@/lib/interview-access";

export type ResumeFrame = { page: number; zoom: number; width: number; height: number; canvas: HTMLCanvasElement; textNodes: Node[]; text: string };
export class ResumeAccessError extends Error {}

/** Owned by one mounted, authenticated interview context. Never a shared or persistent cache. */
export class InterviewResumeResource {
  readonly key: string;
  readonly path: string;
  private generation = 0;
  private abort?: AbortController;
  private blobPromise?: Promise<Blob>;
  private pdfPromise?: Promise<PDFDocumentProxy>;
  private task?: PDFDocumentLoadingTask;
  private listeners = new Set<(event: "loaded" | "invalidated") => void>();
  private thumbnails = new Map<number, HTMLCanvasElement>();
  private frame?: ResumeFrame;
  objectUrl = "";

  constructor(actorId: string, scope: InterviewScope, documentId: string, isDemo: boolean, demoSource = "/demo/sample-resume.pdf") {
    this.key = JSON.stringify([actorId, isDemo, scope.clubId, scope.applicationId, scope.roundId, documentId]);
    this.path = isDemo ? (demoSource === "/demo/sample-scanned-resume.pdf" ? demoSource : "/demo/sample-resume.pdf") : `/api/interview-resumes?${new URLSearchParams({ ...scope, documentId })}`;
  }
  subscribe(listener: (event: "loaded" | "invalidated") => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  getBlob(): Promise<Blob> {
    if (this.blobPromise) return this.blobPromise;
    const epoch = this.generation, controller = new AbortController(); this.abort = controller;
    this.blobPromise = (async () => {
      const response = await fetch(this.path, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new ResumeAccessError("Document access unavailable");
      const blob = await response.blob();
      if (controller.signal.aborted || epoch !== this.generation) throw new Error("Document context changed");
      this.objectUrl = URL.createObjectURL(blob);
      this.listeners.forEach(listener => listener("loaded"));
      return blob;
    })().catch(error => { if (epoch === this.generation) this.blobPromise = undefined; throw error; });
    return this.blobPromise;
  }
  getPdf(): Promise<PDFDocumentProxy> {
    if (this.pdfPromise) return this.pdfPromise;
    const epoch = this.generation;
    this.pdfPromise = (async () => {
      const blob = await this.getBlob();
      const [buffer, library] = await Promise.all([blob.arrayBuffer(), import("pdfjs-dist")]);
      if (epoch !== this.generation) throw new Error("Document context changed");
      library.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      const task = library.getDocument({ data: new Uint8Array(buffer), cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/", iccUrl: "/pdfjs/iccs/" });
      this.task = task;
      const pdf = await task.promise;
      if (epoch !== this.generation) { void task.destroy(); throw new Error("Document context changed"); }
      return pdf;
    })().catch(error => { if (epoch === this.generation) { this.pdfPromise = undefined; const task = this.task; this.task = undefined; if (task) void task.destroy().catch(() => {}); } throw error; });
    return this.pdfPromise;
  }
  thumbnail(page: number) { return this.thumbnails.get(page); }
  rememberThumbnail(page: number, canvas: HTMLCanvasElement) {
    if (canvas.width * canvas.height > 12000000) return;
    this.thumbnails.delete(page); this.thumbnails.set(page, canvas);
    while (this.thumbnails.size > 2) this.thumbnails.delete(this.thumbnails.keys().next().value!);
  }
  currentFrame(page: number, zoom: number) { return this.frame?.page === page && this.frame.zoom === zoom ? this.frame : undefined; }
  rememberFrame(frame: ResumeFrame) { if (frame.canvas.width * frame.canvas.height <= 12000000 && frame.text.length <= 100000) this.frame = frame; }
  invalidate() {
    ++this.generation; this.abort?.abort(); this.abort = undefined;
    const task = this.task; this.task = undefined; if (task) void task.destroy().catch(() => {});
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = ""; this.blobPromise = undefined; this.pdfPromise = undefined;
    this.thumbnails.clear(); this.frame = undefined;
    this.listeners.forEach(listener => listener("invalidated"));
  }
}
