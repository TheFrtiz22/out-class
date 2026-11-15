import { CSP_REPORT_MAX_BYTES, cspReportLog, parseCspReports } from "@/lib/csp-report"

// Browser CSP violation reports (docs/csp.md). Unauthenticated by design; it stores nothing,
// logs only a masked, deduplicated, rate-limited summary, and always answers without detail.
const log = cspReportLog()
const done = (status = 204) => new Response(null, { status, headers: { "Cache-Control": "no-store" } })
const accepted = ["application/csp-report", "application/reports+json", "application/json"]

/** Reads at most `limit` bytes; null when the body is larger, without buffering the rest. */
async function boundedText(request: Request, limit: number) {
  const declared = Number(request.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > limit) return null
  if (!request.body) return ""
  const reader = request.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done: finished, value } = await reader.read()
    if (finished) break
    size += value.byteLength
    if (size > limit) { void reader.cancel().catch(() => {}); return null }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(bytes)
}

export async function POST(request: Request) {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
  if (!accepted.includes(type)) return done(415)
  let text: string | null
  try { text = await boundedText(request, CSP_REPORT_MAX_BYTES) } catch { return done(400) }
  if (text === null) return done(413)
  for (const line of log.accept(parseCspReports(text))) console.warn(line.message, line.data)
  return done()
}
