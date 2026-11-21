/** Inner padding of the tab dock; the selection pill and the tab slots sit inside it. */
export const DOCK_PADDING = 6;
/**
 * Tab sizes, close to Instagram's tab bar: a tall bar nearly the width of the phone, with large icons
 * and readable labels. The dock is DOCK_TAB_HEIGHT + 2 × DOCK_PADDING tall (74pt).
 */
export const DOCK_TAB_HEIGHT = 62;
export const DOCK_ICON = 26;

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

/**
 * Where the pill comes to rest when a finger lets go: a drop lands on the tab under the finger,
 * and a cancelled drag (the system took the touch, say) goes back to the tab you are on.
 */
export function restingSlot(position: number, dropped: boolean, current: number) {
  "worklet";
  return dropped ? Math.round(position) : current;
}
