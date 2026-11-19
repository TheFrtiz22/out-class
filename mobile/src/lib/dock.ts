/** Inner padding of the tab dock; the selection pill and the tab slots sit inside it. */
export const DOCK_PADDING = 6;

/**
 * The tab slot under a point along the dock, as a fractional index (0 is the centre of the first
 * tab, `count - 1` the centre of the last), clamped to the dock. The selection pill follows this
 * while dragged; rounding it gives the tab it locks onto on release.
 */
export function slotAt(x: number, width: number, count: number) {
  "worklet";
  if (count < 1 || width <= DOCK_PADDING * 2) return 0;
  const slot = (width - DOCK_PADDING * 2) / count;
  return Math.min(count - 1, Math.max(0, (x - DOCK_PADDING) / slot - 0.5));
}
