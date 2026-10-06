/** Query-only club navigation preserves the shell and avoids an unused RSC read. */
export function navigateWithinClub(href: string, replace = false): boolean {
  if (typeof window === "undefined" || !window.location?.href) return false
  const current = new URL(window.location.href), next = new URL(href, current)
  if (next.origin !== current.origin || next.pathname !== current.pathname || !/^\/club\/[^/]+\/workspace$/.test(current.pathname)) return false
  if (replace) window.history.replaceState(null, "", next.href)
  else window.history.pushState(null, "", next.href)
  return true
}
export function handleClubLink(event: React.MouseEvent<HTMLAnchorElement>, href: string): void {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  if (navigateWithinClub(href)) event.preventDefault()
}
