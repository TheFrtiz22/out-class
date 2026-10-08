"use client";
import { useEffect, useRef } from "react";
import type { InterviewResumeResource } from "@/lib/interview-resume-resource";

/** The already-visible preview, while access is rechecked or a sharper page is drawn. */
export function InterviewResumePlaceholder({ resource, page = 1 }: { resource: InterviewResumeResource; page?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = resource.currentFrame(page, 1)?.canvas || resource.thumbnail(page);
  useEffect(() => { if (source && canvas.current) { canvas.current.width = source.width; canvas.current.height = source.height; canvas.current.getContext("2d")?.drawImage(source, 0, 0); } }, [source]);
  return source ? <canvas ref={canvas} role="img" aria-label="Résumé preview while the viewer opens" className="mx-auto block h-auto max-w-full rounded border bg-white" /> : <p role="status" className="p-3 text-sm text-muted-foreground">Opening résumé…</p>;
}
