"use client";

import { useId, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { areaFromPoints, areaStyle, clampArea, describeArea, moveArea, nudgeArea, pagePoint, resizeArea, type AreaRect } from "@/lib/resume-area-geometry";

/** Saved area highlights on one rendered page. Positions are percentages of the page box,
 * so they stay aligned at any zoom, viewport or device pixel ratio. They never take
 * pointer events, so text selection underneath keeps working. */
export function AreaHighlightMarks({ areas, active }: { areas: { id: string; rect: AreaRect; label: string }[]; active?: string }) {
  return <>{areas.map(a => <div key={a.id} className="oc-pdf-area" data-area-id={a.id} data-active={a.id === active} role="img" aria-label={a.label} style={areaStyle(a.rect)} />)}</>;
}

type Drag = { mode: "draw" | "move" | "start" | "end"; pointerId: number; origin: { x: number; y: number }; rect: AreaRect };

/** Draw, move or resize one region with mouse, pen or touch; or with the keyboard:
 * arrows move, Shift+arrows resize, Alt for finer steps, Enter to use it, Escape to cancel. */
export function AreaSelector({ pageNumber, rect, onChange, onConfirm, onCancel }: { pageNumber: number; rect: AreaRect; onChange: (rect: AreaRect) => void; onConfirm: (rect: AreaRect) => void; onCancel: () => void }) {
  const setRect = (next: AreaRect) => onChange(clampArea(next));
  const surface = useRef<HTMLDivElement>(null), region = useRef<HTMLButtonElement>(null), drag = useRef<Drag | null>(null);
  const help = useId(), live = useId();
  useLayoutEffect(() => { region.current?.focus({ preventScroll: false }); }, []);
  const point = (event: PointerEvent) => {
    const box = surface.current?.getBoundingClientRect();
    return box ? pagePoint(event.clientX, event.clientY, box) : null;
  };
  function begin(event: PointerEvent<HTMLElement>, mode: Drag["mode"]) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const origin = point(event); if (!origin) return;
    event.preventDefault(); event.stopPropagation();
    surface.current?.setPointerCapture?.(event.pointerId);
    drag.current = { mode, pointerId: event.pointerId, origin, rect };
    if (mode === "draw") setRect(areaFromPoints(origin, origin));
  }
  function update(event: PointerEvent) {
    const d = drag.current; if (!d || d.pointerId !== event.pointerId) return;
    const p = point(event); if (!p) return;
    const dx = p.x - d.origin.x, dy = p.y - d.origin.y;
    setRect(d.mode === "draw" ? areaFromPoints(d.origin, p) : d.mode === "move" ? moveArea(d.rect, dx, dy) : resizeArea(d.rect, d.mode, dx, dy));
  }
  function end(event: PointerEvent) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (surface.current?.hasPointerCapture?.(event.pointerId)) surface.current.releasePointerCapture(event.pointerId);
    region.current?.focus({ preventScroll: true });
  }
  function key(event: KeyboardEvent) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); onConfirm(rect); return; }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); return; }
    const next = nudgeArea(rect, event.key, { resize: event.shiftKey, fine: event.altKey });
    if (next) { event.preventDefault(); event.stopPropagation(); setRect(next); }
  }
  // data-resume-comment-draft keeps the surrounding dialog open on Escape, as for comment drafts.
  return <div ref={surface} className="oc-pdf-area-surface" data-resume-comment-draft="" onPointerDown={e => begin(e, "draw")} onPointerMove={update} onPointerUp={end} onPointerCancel={end}>
    {/* A whole-surface target: the region itself is the keyboard control (Enter adds the note). */}
    <button ref={region} type="button" aria-roledescription="area selection" aria-label={`Area highlight on page ${pageNumber}`} aria-describedby={`${help} ${live}`}
      className="oc-pdf-area oc-pdf-area-editing" data-active="true" style={areaStyle(rect)} onKeyDown={key} onClick={e => { if (e.detail === 0) onConfirm(rect); }} onPointerDown={e => begin(e, "move")}>
      <span className="oc-pdf-area-handle" data-corner="start" aria-hidden="true" onPointerDown={e => begin(e, "start")} />
      <span className="oc-pdf-area-handle" data-corner="end" aria-hidden="true" onPointerDown={e => begin(e, "end")} />
    </button>
    <p id={help} className="sr-only">Arrow keys move the area. Shift with arrow keys resizes it. Hold Alt for smaller steps. Enter adds a note. Escape cancels.</p>
    <p id={live} className="sr-only" aria-live="polite" data-area-position>{describeArea(rect)}</p>
  </div>;
}
