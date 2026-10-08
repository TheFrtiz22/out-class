/** Native scrolling remains untouched; only a stationary primary pointer gesture opens the viewer. */
export function resumePreviewGesture() {
  let start: { x: number; y: number; top: number; left: number; pointer: number } | undefined;
  let eligible = false;
  const cancel = () => { start = undefined; eligible = false; };
  return {
    down(event: { button: number; isPrimary: boolean; pointerId: number; clientX: number; clientY: number }, host: HTMLElement) {
      cancel(); const bounds = host.getBoundingClientRect();
      if (event.button !== 0 || !event.isPrimary || event.clientX - bounds.left >= host.clientWidth || event.clientY - bounds.top >= host.clientHeight) return;
      start = { x: event.clientX, y: event.clientY, top: host.scrollTop, left: host.scrollLeft, pointer: event.pointerId };
    },
    move(event: { pointerId: number; clientX: number; clientY: number }) { if (start && (event.pointerId !== start.pointer || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6)) cancel(); },
    up(event: { pointerId: number }, host: HTMLElement, selected: boolean) {
      eligible = !!start && event.pointerId === start.pointer && host.scrollTop === start.top && host.scrollLeft === start.left && !selected;
      start = undefined;
    },
    click() { const open = eligible; cancel(); return open; }, cancel,
  };
}
