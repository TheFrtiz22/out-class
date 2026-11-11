/**
 * Summaries of browser CSP violation reports (docs/csp.md). Pure, so node:test loads it.
 *
 * A report can carry full URLs with query strings, script samples and referrers, any of which
 * may hold personal data or tokens. Only the directive, the blocked origin (or keyword), the
 * document path with identifiers masked, and the disposition are ever kept.
 */
export const CSP_REPORT_MAX_BYTES = 8 * 1024
const MAX_REPORTS_PER_BODY = 10

export type CspViolationSummary = { directive: string; blocked: string; path: string; disposition: "enforce" | "report" }

const clip = (value: unknown, max = 64) => typeof value === "string" ? value.slice(0, max).replace(/[^\w\-.:/' *]/g, "") : ""

function blockedSource(value: unknown) {
  if (typeof value !== "string" || !value) return "unknown"
  if (["inline", "eval", "wasm-eval", "trusted-types-policy", "trusted-types-sink"].includes(value)) return value
  if (/^(data|blob|about|filesystem|mediastream):/i.test(value)) return value.slice(0, value.indexOf(":")).toLowerCase()
  try { const url = new URL(value); return url.protocol.startsWith("http") || url.protocol.startsWith("ws") ? url.origin.slice(0, 120) : url.protocol.replace(":", "") }
  catch { return clip(value, 32) || "unknown" }
}

/** Path only, with ids (UUIDs, cuids, long numbers or tokens) masked so a record is never identifiable. */
function documentPath(value: unknown) {
  if (typeof value !== "string") return "unknown"
  let pathname: string
  try { pathname = new URL(value).pathname } catch { return "unknown" }
  return pathname.split("/").map(segment =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) || /^c[a-z0-9]{20,}$/.test(segment) || /\d{4,}/.test(segment) || segment.length > 40 ? ":id" : segment.replace(/[^\w\-.]/g, "")
  ).join("/").slice(0, 120) || "/"
}

function summarize(raw: Record<string, unknown>): CspViolationSummary | null {
  // report-uri uses kebab-case; the Reporting API (report-to) uses camelCase.
  const directive = clip(raw["effective-directive"] ?? raw.effectiveDirective ?? raw["violated-directive"], 40).split(" ")[0]
  if (!directive) return null
  return {
    directive,
    blocked: blockedSource(raw["blocked-uri"] ?? raw.blockedURL),
    path: documentPath(raw["document-uri"] ?? raw.documentURL),
    disposition: raw.disposition === "enforce" ? "enforce" : "report",
  }
}

/** Accepts `application/csp-report` ({ "csp-report": {...} }) and `application/reports+json` ([{ type, body }]). */
export function parseCspReports(text: string): CspViolationSummary[] {
  let data: unknown
  try { data = JSON.parse(text) } catch { return [] }
  const bodies: unknown[] = Array.isArray(data)
    ? data.slice(0, MAX_REPORTS_PER_BODY).filter(item => item && typeof item === "object" && (item as { type?: unknown }).type === "csp-violation").map(item => (item as { body?: unknown }).body)
    : data && typeof data === "object" && "csp-report" in data ? [(data as Record<string, unknown>)["csp-report"]] : []
  return bodies.flatMap(body => body && typeof body === "object" && !Array.isArray(body) ? [summarize(body as Record<string, unknown>)].filter((s): s is CspViolationSummary => !!s) : [])
}

/**
 * Per-instance deduplication and rate limit: each distinct violation is logged once per window
 * (with a count of repeats when the window rolls over), at most `maxLogs` lines per window and
 * at most `maxKeys` distinct violations tracked. Serverless instances each keep their own.
 */
export function cspReportLog({ windowMs = 60_000, maxLogs = 20, maxKeys = 200, now = () => Date.now() } = {}) {
  let windowStart = now(), logged = 0, dropped = 0
  let seen = new Map<string, number>()
  return {
    /** Returns the lines to log for these summaries, and rolls the window over when due. */
    accept(summaries: CspViolationSummary[]) {
      const lines: { message: string; data: Record<string, unknown> }[] = []
      if (now() - windowStart >= windowMs) {
        const repeats = [...seen.values()].reduce((sum, count) => sum + count - 1, 0)
        if (repeats || dropped) lines.push({ message: "CSP violations repeated", data: { distinct: seen.size, repeats, dropped } })
        windowStart = now(); logged = 0; dropped = 0; seen = new Map()
      }
      for (const summary of summaries) {
        const key = `${summary.disposition}|${summary.directive}|${summary.blocked}|${summary.path}`
        const count = seen.get(key)
        if (count !== undefined) { seen.set(key, count + 1); continue }
        if (seen.size >= maxKeys || logged >= maxLogs) { dropped++; continue }
        seen.set(key, 1); logged++
        lines.push({ message: "CSP violation", data: { ...summary } })
      }
      return lines
    },
  }
}
