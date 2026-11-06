/**
 * Privacy filter for error reports. OutClass handles applicant data, notes,
 * resumes and ballots, so reports keep only what is needed to find a bug:
 * the error, its stack, the route path and the browser. Request bodies,
 * cookies, headers, query strings, console output and typed input never leave.
 */
type Crumb = { category?: string; message?: string; data?: Record<string, unknown> }
type ReportEvent = {
  message?: string
  request?: { url?: string; data?: unknown; cookies?: unknown; query_string?: unknown; headers?: Record<string, string>; env?: unknown }
  user?: Record<string, unknown>
  breadcrumbs?: Crumb[]
  exception?: { values?: { value?: string }[] }
  extra?: Record<string, unknown>
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
/** Bearer-like values in messages: JWTs and long opaque tokens. */
const TOKEN = /\b(?:eyJ[\w-]+\.[\w-]+\.[\w-]+|[A-Za-z0-9_-]{40,})\b/g

export function redactText(value: string) {
  return value.replace(EMAIL, "[email]").replace(TOKEN, "[token]")
}

/** Path only: query strings and fragments carry invitation, reset and short-link tokens. */
export function stripUrl(value: unknown) {
  if (typeof value !== "string") return value
  const cut = value.search(/[?#]/)
  return cut === -1 ? value : value.slice(0, cut)
}

export function scrubBreadcrumb<T extends Crumb>(crumb: T): T | null {
  // Console lines and typed input can contain anything a page logged or a person entered.
  if (crumb.category === "console" || crumb.category === "ui.input") return null
  const next = { ...crumb }
  if (next.message) next.message = redactText(stripUrl(next.message) as string)
  if (next.data) {
    const data: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(next.data)) {
      if (["url", "to", "from"].includes(key)) data[key] = stripUrl(value)
      else if (["method", "status_code", "reason"].includes(key)) data[key] = value
    }
    next.data = data
  }
  return next
}

export function scrubEvent<T extends ReportEvent>(event: T): T {
  if (event.request) {
    const userAgent = event.request.headers?.["user-agent"] ?? event.request.headers?.["User-Agent"]
    event.request = {
      url: stripUrl(event.request.url) as string | undefined,
      ...(userAgent ? { headers: { "user-agent": userAgent } } : {}),
    }
  }
  // Keep only the opaque account ID; never email, name or IP address.
  event.user = typeof event.user?.id === "string" ? { id: event.user.id } : undefined
  if (event.message) event.message = redactText(event.message)
  for (const value of event.exception?.values ?? []) if (value.value) value.value = redactText(value.value)
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.flatMap(crumb => scrubBreadcrumb(crumb) ?? [])
  delete event.extra
  return event
}

/** Reports are off unless a DSN is configured. */
export function sentryOptions(dsn: string | undefined, environment: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: environment || "development",
    sendDefaultPii: false,
    // Errors only: no performance tracing or session replay, which keeps the
    // free plan's quota for errors and never records page contents.
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  }
}
