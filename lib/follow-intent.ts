/**
 * Signed-out "Follow" on a club (for example after scanning the club's QR code at a fair):
 * the visitor creates an account or signs in, and comes back to the same page with
 * `?follow=<clubId>`, where CorkboardButton finishes the save for them. Pure, so tests can
 * check the paths without a browser. Only the club id is carried; nothing private.
 */
export const FOLLOW_PARAM = "follow"

const CLUB_ID = /^[a-z0-9][a-z0-9-]{0,79}$/i

/** The club id a returning page should save, or null when the address carries none (or a malformed one). */
export function readFollowIntent(search: string): string | null {
  const value = new URLSearchParams(search).get(FOLLOW_PARAM)?.trim() ?? ""
  return CLUB_ID.test(value) ? value : null
}

/** Current page plus `follow=<clubId>`; other query parameters are kept and the fragment dropped. */
export function followReturnPath(pathname: string, search: string, clubId: string): string {
  const query = new URLSearchParams(search)
  query.set(FOLLOW_PARAM, clubId)
  return `${pathname}?${query.toString()}`
}

/** The same address without the follow intent, for history.replaceState once the save is done. */
export function withoutFollowIntent(pathname: string, search: string, hash = ""): string {
  const query = new URLSearchParams(search)
  query.delete(FOLLOW_PARAM)
  const rest = query.toString()
  return `${pathname}${rest ? `?${rest}` : ""}${hash}`
}

/** Sign-up or sign-in entry that returns to `returnPath` afterwards. */
export function authEntryWithReturn(route: "/signup" | "/login", returnPath: string): string {
  return `${route}?next=${encodeURIComponent(returnPath)}`
}
