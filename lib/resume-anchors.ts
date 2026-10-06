import type { z } from "zod";
import type { annotationContentSchema } from "@/lib/interview-access";

export type ResumeAnchor = NonNullable<z.infer<typeof annotationContentSchema>["anchor"]>;
export function anchorMatchesText(anchor: ResumeAnchor, text: string, pageCount: number) {
  return anchor.page <= pageCount && anchor.end <= text.length &&
    text.slice(anchor.start, anchor.end) === anchor.quote &&
    text.slice(Math.max(0, anchor.start - anchor.prefix.length), anchor.start) === anchor.prefix &&
    text.slice(anchor.end, anchor.end + anchor.suffix.length) === anchor.suffix;
}
export function normalizedRect(rect: { left: number; top: number; right: number; bottom: number }, page: { left: number; top: number; width: number; height: number }) {
  if (page.width <= 0 || page.height <= 0) return null;
  const x = Math.max(0, Math.min(1, (rect.left - page.left) / page.width));
  const y = Math.max(0, Math.min(1, (rect.top - page.top) / page.height));
  const right = Math.max(0, Math.min(1, (rect.right - page.left) / page.width));
  const bottom = Math.max(0, Math.min(1, (rect.bottom - page.top) / page.height));
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}
/** UTF-16 offsets refer to PDF.js's concatenated text items, not changing screen coordinates. */
export function anchorFromRange(range: Range, layer: HTMLElement, page: HTMLElement, pageNumber: number): ResumeAnchor | null {
  if (!layer.contains(range.startContainer) || !layer.contains(range.endContainer)) return null;
  const quote = range.toString();
  if (!quote.trim() || quote.length > 10000) return null;
  const before = range.cloneRange(); before.selectNodeContents(layer); before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length, end = start + quote.length;
  const text = layer.textContent || "";
  const rectangles = Array.from(range.getClientRects()).map(r => normalizedRect(r, page.getBoundingClientRect())).filter((r): r is NonNullable<typeof r> => !!r);
  if (!rectangles.length || rectangles.length > 200) return null;
  return { page: pageNumber, start, end, quote, prefix: text.slice(Math.max(0, start - 80), start), suffix: text.slice(end, end + 80), rectangles };
}
/** Keyboard alternative to dragging a selection; only selects text actually in this document. */
export function rangeForText(layer: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  const range = document.createRange(); let offset = 0, began = false;
  while (walker.nextNode()) {
    const node = walker.currentNode, length = node.textContent?.length || 0;
    if (!began && start < offset + length) { range.setStart(node, start - offset); began = true; }
    if (began && end <= offset + length) { range.setEnd(node, end - offset); return range; }
    offset += length;
  }
  return null;
}
