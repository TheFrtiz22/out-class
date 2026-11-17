/**
 * Sign-up and sign-in pages reached from a public club page (often right after scanning the
 * club's QR code) say which club the visitor is on their way to. Only the club's public name is
 * shown, the same name its public page already shows. Pure, so tests can check the parsing.
 */
export type ReturnClub = { ref: string; follow: boolean }

const CLUB_REF = /^[a-z0-9][a-z0-9-]{0,79}$/i

/** The club a same-site return path leads to: "/club/<id-or-slug>" (with any query), nothing deeper. */
export function returnClub(next: string): ReturnClub | null {
  let url: URL
  try { url = new URL(next, "https://outclass.invalid") } catch { return null }
  if (url.origin !== "https://outclass.invalid") return null
  const match = /^\/club\/([^/]+)\/?$/.exec(url.pathname)
  if (!match) return null
  let ref: string
  try { ref = decodeURIComponent(match[1]) } catch { return null }
  if (!CLUB_REF.test(ref)) return null
  return { ref, follow: !!url.searchParams.get("follow") }
}

/** One line under the sign-up or sign-in heading. */
export function clubContextLine(name: string, follow: boolean, mode: "signup" | "login"): string {
  if (mode === "signup") return follow
    ? `Create your profile to follow ${name}. You’ll go right back to it.`
    : `Create your profile to continue to ${name}. You’ll go right back to it.`
  return follow ? `Sign in to follow ${name}.` : `Sign in to continue to ${name}.`
}
