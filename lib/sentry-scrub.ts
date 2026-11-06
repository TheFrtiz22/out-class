/**
 * Privacy filter for error reports. OutClass handles applicant data, notes,
 * resumes and ballots, so reports are rebuilt from an allowlist: the error
 * type, a redacted message, stack locations, the route shape and the browser.
 * Request bodies, cookies, headers, query strings, IDs and tokens in paths,
 * contexts, tags, local variables, console output and typed input never leave.
 */
type Frame = { filename?: string; abs_path?: string; function?: string; module?: string; lineno?: number; colno?: number; in_app?: boolean }
type ExceptionValue = { type?: string; value?: string; stacktrace?: { frames?: Frame[] }; mechanism?: { type?: string; handled?: boolean } }
type Crumb = { type?: string; category?: string; level?: string; timestamp?: number; message?: string; data?: Record<string, unknown> }
type ReportEvent = {
  event_id?: string; timestamp?: number; platform?: string; level?: string; environment?: string; release?: string; dist?: string
  message?: string; transaction?: string
  request?: { url?: string; headers?: Record<string, string> }
  user?: Record<string, unknown>
  breadcrumbs?: Crumb[]
  exception?: { values?: ExceptionValue[] }
  sdk?: unknown
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
/** Bearer-like values in messages: JWTs and long opaque tokens. */
const TOKEN = /\b(?:eyJ[\w-]+\.[\w-]+\.[\w-]+|[A-Za-z0-9_-]{40,})\b/g
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
/** Path segments after these carry share codes or invitation identifiers. */
const TOKEN_ROUTES = new Set(["q", "s", "invitations", "check-in"])

export function redactText(value: string) {
  return value.replace(EMAIL, "[email]").replace(TOKEN, "[token]").slice(0, 1000)
}

/** Route shape only: no query, fragment, IDs or share codes. Host is kept for absolute URLs. */
export function stripUrl(value: unknown) {
  if (typeof value !== "string") return undefined
  const cut = value.search(/[?#]/)
  const bare = cut === -1 ? value : value.slice(0, cut)
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/]+)?(.*)$/i.exec(bare)!
  // API routes: the handler name is enough; later segments are object keys and IDs.
  const segments = match[2].startsWith("/api/") ? match[2].split("/").slice(0, 3).concat(match[2].split("/").length > 3 ? ["[id]"] : []) : match[2].split("/")
  const shaped = segments.map((segment, i) => {
    if (!segment) return segment
    if (segment === "[id]" || TOKEN_ROUTES.has(segments[i - 1]) || new RegExp(UUID.source, "i").test(segment) || !/^[a-z][a-z-]{0,39}$/.test(segment)) return "[id]"
    return segment
  })
  return (match[1] ?? "") + shaped.join("/")
}

export function scrubBreadcrumb<T extends Crumb>(crumb: T): T | null {
  // Only navigation, clicks and request outcomes are useful; never console lines or typed input.
  if (!["navigation", "ui.click", "fetch", "xhr"].includes(crumb.category ?? "")) return null
  const data: Record<string, unknown> = {}
  for (const key of ["url", "to", "from"]) if (crumb.data?.[key] !== undefined) data[key] = stripUrl(crumb.data[key])
  for (const key of ["method", "status_code"]) if (crumb.data?.[key] !== undefined) data[key] = crumb.data[key]
  // Click selectors can carry labels or text; the category alone shows that a click happened.
  return { type: crumb.type, category: crumb.category, level: crumb.level, timestamp: crumb.timestamp, ...(Object.keys(data).length ? { data } : {}) } as T
}

function frame(value: Frame): Frame {
  return { filename: value.filename, function: value.function, module: value.module, lineno: value.lineno, colno: value.colno, in_app: value.in_app }
}

export function scrubEvent<T extends ReportEvent>(event: T): T {
  const userAgent = event.request?.headers?.["user-agent"] ?? event.request?.headers?.["User-Agent"]
  const url = stripUrl(event.request?.url)
  const clean: ReportEvent = {
    event_id: event.event_id, timestamp: event.timestamp, platform: event.platform, level: event.level,
    environment: event.environment, release: event.release, dist: event.dist, sdk: event.sdk,
    transaction: typeof event.transaction === "string" ? stripUrl(event.transaction.replace(/^[A-Z]+ /, "")) : undefined,
    message: typeof event.message === "string" ? redactText(event.message) : undefined,
    exception: event.exception?.values ? { values: event.exception.values.map(value => ({
      type: value.type,
      value: typeof value.value === "string" ? redactText(value.value) : undefined,
      mechanism: value.mechanism ? { type: value.mechanism.type, handled: value.mechanism.handled } : undefined,
      stacktrace: value.stacktrace?.frames ? { frames: value.stacktrace.frames.map(frame) } : undefined,
    })) } : undefined,
    request: url || userAgent ? { ...(url ? { url } : {}), ...(userAgent ? { headers: { "user-agent": userAgent } } : {}) } : undefined,
    // Only the opaque account ID, never email, name or IP address.
    user: typeof event.user?.id === "string" ? { id: event.user.id } : undefined,
    breadcrumbs: event.breadcrumbs?.flatMap(crumb => scrubBreadcrumb(crumb) ?? []),
  }
  const record = clean as Record<string, unknown>
  for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key]
  return clean as T
}

/** Reports are off unless a DSN is configured. */
export function sentryOptions(dsn: string | undefined, environment: string | undefined, runtime: "browser" | "server" = "browser") {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: environment || "development",
    sendDefaultPii: false,
    // Errors only: no performance tracing or session replay, which keeps the
    // free plan's quota for errors and never records page contents.
    tracesSampleRate: 0,
    maxValueLength: 1000,
    sendClientReports: false,
    // Server breadcrumbs record outbound calls to Supabase, Storage and email providers.
    maxBreadcrumbs: runtime === "server" ? 0 : 30,
    beforeSend: scrubEvent,
    beforeSendTransaction: () => null,
    beforeBreadcrumb: scrubBreadcrumb,
  }
}
