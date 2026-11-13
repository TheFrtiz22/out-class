/**
 * Privacy filter for error reports. OutClass handles applicant data, notes,
 * resumes and ballots, so reports are rebuilt from an allowlist: the error
 * type, a redacted message, stack locations, the route shape and the browser.
 * Request bodies, cookies, headers, query strings, IDs and tokens in paths,
 * contexts (other than trace IDs), tags, local variables, console output and typed
 * input never leave.
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
  contexts?: { trace?: { trace_id?: unknown; span_id?: unknown } & Record<string, unknown> } & Record<string, unknown>
  /** Never sent as part of the payload: the SDK reads it to build the envelope's trace header, then deletes it. */
  sdkProcessingMetadata?: { dynamicSamplingContext?: Record<string, unknown> } & Record<string, unknown>
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

/**
 * The trace header Sentry uses to count sampled traffic correctly. Kept fields are IDs,
 * the sample rate and decision, environment and release; the transaction name is
 * reduced to its route shape and anything else (user segment, custom values) is dropped.
 */
export function scrubSamplingContext(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  const source = value as Record<string, unknown>, clean: Record<string, string> = {}
  for (const key of ["trace_id", "public_key", "org_id", "sample_rate", "sample_rand", "sampled", "environment", "release"]) {
    if (typeof source[key] === "string") clean[key] = source[key] as string
  }
  if (typeof source.transaction === "string") {
    const method = /^[A-Z]+ /.exec(source.transaction)?.[0]
    clean.transaction = (method ?? "") + stripUrl(source.transaction.slice(method?.length ?? 0))
  }
  return Object.keys(clean).length ? clean : undefined
}

function processingMetadata(event: ReportEvent) {
  const dynamicSamplingContext = scrubSamplingContext(event.sdkProcessingMetadata?.dynamicSamplingContext)
  return dynamicSamplingContext ? { dynamicSamplingContext } : undefined
}

/** IDs linking an error to the timed request it happened in. */
function traceIds(event: ReportEvent) {
  const trace = event.contexts?.trace
  const ids: Record<string, string> = {}
  for (const key of ["trace_id", "span_id"] as const) if (typeof trace?.[key] === "string" && /^[0-9a-f]{16,32}$/.test(trace[key] as string)) ids[key] = trace[key] as string
  return Object.keys(ids).length ? { trace: ids } : undefined
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
    contexts: traceIds(event),
    sdkProcessingMetadata: processingMetadata(event),
  }
  const record = clean as Record<string, unknown>
  for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key]
  return clean as T
}

type Span = {
  trace_id?: string; span_id?: string; parent_span_id?: string; op?: string; description?: string; status?: string; origin?: string
  start_timestamp?: number; timestamp?: number
}
type TransactionEvent = ReportEvent & {
  type?: string; start_timestamp?: number; spans?: Span[]
  measurements?: Record<string, { value?: unknown; unit?: unknown } | undefined>
  transaction_info?: { source?: string }
}

/**
 * Span names are kept only for operations whose names are requests, routes or assets.
 * Everything else (database and cache spans with SQL or keys, UI spans with element
 * text, custom spans) keeps its timing and operation only.
 */
const NAMED_SPAN_OPS = /^(http|resource|navigation|pageload|function\.nextjs)/

/**
 * Calls to other services (Supabase REST and Storage, email providers) keep the host and
 * the service name only: their later path segments are table filters and object keys,
 * which can look like ordinary words.
 */
function serviceUrl(value: string) {
  const match = /^([a-z][a-z0-9+.-]*:\/\/)(?:[^/?#@]*@)?([^/?#]+)(\/[^/?#]*)?(\/[^?#]*)?/i.exec(value)!
  return match[1] + match[2] + (match[3] ? stripUrl(match[3]) : "") + (match[4] && match[4] !== "/" ? "/[id]" : "")
}

/**
 * Span names, reduced to words and route shapes. Anything that is not a plain word
 * (IDs, numbers, quoted values, emails) becomes [id]; app paths lose query strings and
 * IDs the same way report URLs do, and absolute URLs keep only host and service.
 */
export function describeSpan(op: string | undefined, description: unknown) {
  if (typeof description !== "string" || !NAMED_SPAN_OPS.test(op ?? "")) return undefined
  return description.split(/\s+/).filter(Boolean).slice(0, 8)
    .map(word => /^[a-z][a-z0-9+.-]*:\/\//i.test(word) ? serviceUrl(word) : word.includes("/") ? stripUrl(word) : /^[A-Za-z()_.:-]{1,40}$/.test(word) ? word : "[id]")
    .join(" ")
}

function span(value: Span): Span {
  return {
    trace_id: value.trace_id, span_id: value.span_id, parent_span_id: value.parent_span_id, op: value.op,
    description: describeSpan(value.op, value.description), status: value.status, origin: value.origin,
    start_timestamp: value.start_timestamp, timestamp: value.timestamp,
  }
}

/** Only Sentry's own sampling and naming fields from the trace data; request attributes never. */
function traceData(data: unknown) {
  if (!data || typeof data !== "object") return {}
  const source = data as Record<string, unknown>, kept: Record<string, unknown> = {}
  if (typeof source["sentry.sample_rate"] === "number") kept["sentry.sample_rate"] = source["sentry.sample_rate"]
  if (typeof source["sentry.source"] === "string" && /^[a-z]{1,20}$/.test(source["sentry.source"] as string)) kept["sentry.source"] = source["sentry.source"]
  return Object.keys(kept).length ? { data: kept } : {}
}

/**
 * Privacy filter for performance data: the same allowlist idea as scrubEvent. Kept:
 * timings, operations, route shapes, web-vital numbers, status. Never kept: span
 * data and attributes (URLs with query strings, SQL, headers, element selectors),
 * user, tags, extra, breadcrumbs, request bodies.
 */
export function scrubTransaction<T extends TransactionEvent>(event: T): T {
  const userAgent = event.request?.headers?.["user-agent"] ?? event.request?.headers?.["User-Agent"]
  const url = stripUrl(event.request?.url)
  const name = typeof event.transaction === "string" ? event.transaction : undefined
  const method = name && /^[A-Z]+ /.exec(name)?.[0]
  const trace = event.contexts?.trace as (Span & { data?: unknown }) | undefined
  const measurements: Record<string, { value: number; unit?: string }> = {}
  for (const [key, value] of Object.entries(event.measurements ?? {})) {
    if (/^[A-Za-z_.]{1,40}$/.test(key) && typeof value?.value === "number") measurements[key] = { value: value.value, ...(typeof value.unit === "string" ? { unit: value.unit } : {}) }
  }
  const clean: TransactionEvent = {
    type: event.type, event_id: event.event_id, timestamp: event.timestamp, start_timestamp: event.start_timestamp,
    platform: event.platform, level: event.level, environment: event.environment, release: event.release, dist: event.dist, sdk: event.sdk,
    transaction: name ? (method ?? "") + stripUrl(name.slice(method?.length ?? 0)) : undefined,
    transaction_info: event.transaction_info?.source ? { source: event.transaction_info.source } : undefined,
    contexts: trace ? { trace: { ...span(trace as Span), ...traceData(trace.data) } } : undefined,
    sdkProcessingMetadata: processingMetadata(event),
    spans: event.spans?.map(span),
    measurements: Object.keys(measurements).length ? measurements : undefined,
    request: url || userAgent ? { ...(url ? { url } : {}), ...(userAgent ? { headers: { "user-agent": userAgent } } : {}) } : undefined,
  }
  const record = clean as Record<string, unknown>
  for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key]
  return clean as T
}

/** The SDK's metric shape; unit is widened so any SDK unit type is accepted and only "millisecond" is kept. */
type MetricRecord = { name: string; value: number; type: string; unit?: unknown; attributes?: Record<string, unknown> }
const METRIC_NAMES = /^web_vital\.(lcp|inp|cls|fcp|ttfb)$/
/** A route template: plain word segments and [param] placeholders only, or "other". */
const ROUTE_TEMPLATE = /^(other|\/|(\/([a-z][a-z-]{0,39}|\[[A-Za-z]{1,30}\]))+)$/

/**
 * Privacy filter for metrics: only the web-vital distributions, tagged with a route template and
 * rating plus Sentry's release, environment and SDK. The SDK's user attributes (id, email, name)
 * and any other metric are dropped.
 */
export function scrubMetric<T extends MetricRecord>(metric: T): T | null {
  if (!METRIC_NAMES.test(metric.name) || metric.type !== "distribution" || !Number.isFinite(metric.value)) return null
  const source = metric.attributes ?? {}, attributes: Record<string, unknown> = {}
  if (typeof source.route !== "string" || !ROUTE_TEMPLATE.test(source.route)) return null
  attributes.route = source.route
  if (typeof source.rating === "string" && ["good", "needs-improvement", "poor"].includes(source.rating)) attributes.rating = source.rating
  for (const key of ["sentry.release", "sentry.environment", "sentry.sdk.name", "sentry.sdk.version"]) if (typeof source[key] === "string") attributes[key] = source[key]
  return { name: metric.name, value: metric.value, type: metric.type, ...(metric.unit === "millisecond" ? { unit: metric.unit } : {}), attributes } as T
}

/**
 * Share of production requests and page loads timed. Previews and development send
 * no performance data, so test traffic never spends the plan's span quota.
 */
export const PRODUCTION_TRACES_SAMPLE_RATE = 0.1

/** Reports are off unless a DSN is configured. */
export function sentryOptions(dsn: string | undefined, environment: string | undefined, runtime: "browser" | "server" = "browser") {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: environment || "development",
    sendDefaultPii: false,
    // Errors plus sampled performance timings in production. No session replay:
    // page contents are never recorded.
    tracesSampleRate: environment === "production" ? PRODUCTION_TRACES_SAMPLE_RATE : 0,
    // The server never adds trace headers to calls to Supabase, Storage or email providers.
    ...(runtime === "server" ? { tracePropagationTargets: [] as string[] } : {}),
    maxValueLength: 1000,
    sendClientReports: false,
    // Server breadcrumbs record outbound calls to Supabase, Storage and email providers.
    maxBreadcrumbs: runtime === "server" ? 0 : 30,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubTransaction,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSendMetric: scrubMetric,
  }
}
