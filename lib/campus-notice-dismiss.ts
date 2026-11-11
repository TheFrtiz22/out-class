/**
 * Per-session dismissal of the campus notice, shared by the server (root layout skips a
 * dismissed notice, so it never flashes) and the client (writes the session cookie).
 * The key changes with the text, so a new notice reappears after an earlier one was dismissed.
 * Cookie-safe characters only; no zod here, this module ships to the browser.
 */
export function campusNoticeDismissKey(text: string) {
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = (hash * 33 + text.charCodeAt(i)) >>> 0
  return `oc-campus-notice-${hash.toString(36)}`
}

/** Session cookie (no Max-Age/Expires): cleared when the browser session ends. */
export function campusNoticeDismissCookie(text: string) {
  return `${campusNoticeDismissKey(text)}=1; path=/; SameSite=Lax`
}
