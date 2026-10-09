/** Exact UVA domain only; reject lookalike domains, whitespace, and malformed addresses. */
export function isUvaEmail(value: string): boolean {
  return /^[a-z0-9]+(?:[._+-][a-z0-9]+)*@virginia\.edu$/i.test(value.trim())
}

/** Keep sign-in return destinations on this origin. */
export function safeReturnPath(raw: string | null | undefined): string {
  const value = raw?.trim() || "/"
  return !value.startsWith("/") || value.startsWith("//") || value.includes("://") || /[\\\x00-\x20]/.test(value) ? "/" : value
}

/** Successful sign-in opens the workspace unless a specific return route was requested. */
export function signInReturnPath(raw: string | null | undefined): string {
  const path = safeReturnPath(raw)
  return path === "/" ? "/?workspace=student" : path
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

export function authenticationError(code: unknown): string {
  if (code === "uva_only") return "Please sign in using your UVA Microsoft account (@virginia.edu)."
  if (code === "auth-code-expired") return "Your sign-in link has expired. Please try again."
  return ""
}

/** Failed OAuth exchanges retain the same signup or invitation/claim context. */
export function authFailurePath(next: string, error: "uva_only" | "auth-code-expired"): string {
  const target = new URL(next, "https://outclass.invalid")
  if (target.pathname === "/signup") {
    target.searchParams.set("error", error)
    return `${target.pathname}${target.search}`
  }
  const query = new URLSearchParams({ error })
  if (next !== "/login") query.set("next", next)
  return authEntryHref("/login", query.toString())
}
