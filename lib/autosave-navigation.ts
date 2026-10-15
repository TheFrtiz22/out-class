"use client"
/** Collect pending editor writes before shell navigation or an explicit commit. */
export async function flushEditors() {
  const pending: Promise<void>[] = []
  window.dispatchEvent(new CustomEvent("outclass:flush-editors", { detail: pending }))
  await Promise.all(pending)
}
let users = 0, replaying = false
async function navigate(event: MouseEvent) {
  if (replaying || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>("nav a, nav button, [data-shell-navigation], a[href]") : null
  if (!target || target.closest('[data-autosave-editor="true"]')) return
  const pending: Promise<void>[] = []
  window.dispatchEvent(new CustomEvent("outclass:flush-editors", { detail: pending }))
  if (!pending.length) return
  event.preventDefault(); event.stopImmediatePropagation()
  try {
    await Promise.all(pending)
    // Let React commit the cleared dirty flags before the shell checks them.
    setTimeout(() => { if (target.isConnected) { replaying = true; try { target.click() } finally { replaying = false } } }, 0)
  } catch { /* Inline save status offers retry; keep focus and text in the editor. */ }
}
export function registerAutosaveNavigation() {
  if (users++ === 0) document.addEventListener("click", navigate, true)
  return () => { if (--users === 0) document.removeEventListener("click", navigate, true) }
}
