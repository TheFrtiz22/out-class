// Page-relative geometry for résumé area highlights. Every value is 0–1 of the rendered
// page's width or height, so a saved region lines up at any zoom, screen size or pixel ratio.
// No imports: shared by the viewer, tests and the server-side schema's rounding rules.
export type AreaRect = { x: number; y: number; width: number; height: number };

const grid = 10000, min = 0.005;
const snap = (v: number) => Math.round(v * grid) / grid;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Inside the page, at least the minimum size, on the stored 1/10,000 grid. */
export function clampArea(r: AreaRect): AreaRect {
  const width = clamp(r.width, min, 1), height = clamp(r.height, min, 1);
  const x = clamp(r.x, 0, 1 - width), y = clamp(r.y, 0, 1 - height);
  const sx = snap(x), sy = snap(y);
  return { x: sx, y: sy, width: Math.min(snap(width), snap(1 - sx)), height: Math.min(snap(height), snap(1 - sy)) };
}

/** A pointer position relative to the page box, as 0–1 fractions. */
export function pagePoint(clientX: number, clientY: number, page: { left: number; top: number; width: number; height: number }) {
  if (page.width <= 0 || page.height <= 0) return null;
  return { x: clamp((clientX - page.left) / page.width, 0, 1), y: clamp((clientY - page.top) / page.height, 0, 1) };
}

/** The rectangle spanned by two page points, in either drag direction. */
export function areaFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): AreaRect {
  return clampArea({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) });
}

export function moveArea(r: AreaRect, dx: number, dy: number): AreaRect {
  return clampArea({ ...r, x: clamp(r.x + dx, 0, 1 - r.width), y: clamp(r.y + dy, 0, 1 - r.height) });
}

/** Resize from one corner while the opposite corner stays put. */
export function resizeArea(r: AreaRect, corner: "start" | "end", dx: number, dy: number): AreaRect {
  if (corner === "end") return clampArea({ ...r, width: clamp(r.width + dx, min, 1 - r.x), height: clamp(r.height + dy, min, 1 - r.y) });
  const right = r.x + r.width, bottom = r.y + r.height;
  const x = clamp(r.x + dx, 0, right - min), y = clamp(r.y + dy, 0, bottom - min);
  return clampArea({ x, y, width: right - x, height: bottom - y });
}

export const areaStep = 0.01, fineAreaStep = 0.002;
/** Arrow keys move; Shift+arrows resize from the bottom-right corner; Alt makes either finer. */
export function nudgeArea(r: AreaRect, key: string, options: { resize: boolean; fine: boolean }): AreaRect | null {
  const step = options.fine ? fineAreaStep : areaStep;
  const delta = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[key];
  if (!delta) return null;
  return options.resize ? resizeArea(r, "end", delta[0], delta[1]) : moveArea(r, delta[0], delta[1]);
}

/** A sensible first region for keyboard creation: the middle band of the page. */
export const defaultArea: AreaRect = { x: 0.2, y: 0.4, width: 0.6, height: 0.15 };

export function areaStyle(r: AreaRect) {
  return { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` };
}

/** Plain-language position, for screen readers while moving or resizing. */
export function describeArea(r: AreaRect) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return `${pct(r.x)} from left, ${pct(r.y)} from top, ${pct(r.width)} wide, ${pct(r.height)} tall`;
}
