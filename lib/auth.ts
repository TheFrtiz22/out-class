/** Exact UVA domain only; reject lookalike domains, whitespace, and malformed addresses. */
export function isUvaEmail(value: string): boolean {
  return /^[a-z0-9]+(?:[._+-][a-z0-9]+)*@virginia\.edu$/i.test(value.trim())
}

/**
 * The path part of a return destination stays a plain same-site path at every
 * decoding step: no encoded slashes, backslashes or dots, no "." or ".."
 * segments, and no leading "//". The query string keeps its normal encoding.
 */
function isPlainReturnPathname(pathname: string): boolean {
  let layer = pathname
  for (let step = 0; step < 4; step++) {
    if (/%(2f|5c|2e)/i.test(layer) || /[\\\x00-\x1f\x7f]/.test(layer) || layer.startsWith("//")) return false
    if (layer.split("/").some(segment => segment === "." || segment === "..")) return false
    let decoded: string
    // Malformed escapes are refused; a literal "%" left by an earlier step is fine.
    try { decoded = decodeURIComponent(layer) } catch { return step > 0 }
    if (decoded === layer) return true
    layer = decoded
  }
  return false
}

/** Keep sign-in return destinations on this origin. */
export function safeReturnPath(raw: string | null | undefined): string {
  const value = raw?.trim() || "/"
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://") || /[\\\x00-\x20]/.test(value)) return "/"
  return isPlainReturnPathname(value.split(/[?#]/, 1)[0]) ? value : "/"
}

/** Successful sign-in opens the workspace unless a specific return route was requested. */
export function signInReturnPath(raw: string | null | undefined): string {
  const path = safeReturnPath(raw)
  return path === "/" ? "/home" : path
}

/** Resolve the current account's workspace on the server after normal sign-in. */
export function loginReturnPath(raw: string | null | undefined): string {
  const path = safeReturnPath(raw)
  return path === "/" ? "/login" : path
}

/** Signup keeps claim/invitation destinations, never a platform administration entry. */
export function signupReturnPath(raw: string | null | undefined): string {
  const path = safeReturnPath(raw)
  let pathname: string
  try { pathname = decodeURIComponent(new URL(path, "https://outclass.invalid").pathname) } catch { return "/" }
  return /^\/(platform|login|signup)(\/|$)/i.test(pathname) ? "/" : path
}

/** Switching account entry pages retains the full invitation/claim query. */
export function authEntryHref(route: "/login" | "/signup", query: string): string {
  return `${route}${query ? `?${query.replace(/^\?/, "")}` : ""}`
}

export const EMAIL_CODE_REQUIRED_MESSAGE = "Sign in with the code sent to your UVA email to finish setting up your account."

export function authenticationError(code: unknown): string {
  if (code === "uva_only") return "Please sign in using your UVA email (@virginia.edu)."
  if (code === "auth-code-expired") return "Your sign-in link has expired. Please try again."
  if (code === "email-code-required") return EMAIL_CODE_REQUIRED_MESSAGE
  return ""
}

/** Failed OAuth exchanges retain the same signup or invitation/claim context. */
export function authFailurePath(next: string, error: "uva_only" | "auth-code-expired" | "email-code-required"): string {
  const target = new URL(next, "https://outclass.invalid")
  if (target.pathname === "/signup") {
    target.searchParams.set("error", error)
    return `${target.pathname}${target.search}`
  }
  const query = new URLSearchParams({ error })
  if (next !== "/login") query.set("next", next)
  return authEntryHref("/login", query.toString())
}
