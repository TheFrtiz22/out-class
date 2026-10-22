import { gzip, constants } from "node:zlib"
import { promisify } from "node:util"
import { serverPhase } from "@/lib/server-phase-trace"
const compress = promisify(gzip)
function acceptsGzip(value: string | null) {
  const entries = (value ?? "").toLowerCase().split(",").map(entry => {
    const [name, ...parameters] = entry.trim().split(";")
    const quality = parameters.find(parameter => parameter.trim().startsWith("q="))?.trim().slice(2)
    return { name, quality: quality === undefined ? 1 : Number(quality) }
  })
  const selected = entries.find(entry => entry.name === "gzip") ?? entries.find(entry => entry.name === "*")
  return !!selected && selected.quality > 0 && selected.quality <= 1
}
/** Next compresses RSC action replies locally, but not these JSON Responses.
 * Keep large GET reads competitive without changing CDN or cache behavior.
 */
export async function workspaceJsonResponse(data: unknown, request: Request, initialHeaders: HeadersInit) {
  const headers = new Headers(initialHeaders)
  headers.set("Content-Type", "application/json")
  headers.append("Vary", "Accept-Encoding")
  const bytes = Buffer.from(JSON.stringify(data))
  if (bytes.length < 1024 || !acceptsGzip(request.headers.get("Accept-Encoding"))) return new Response(bytes, { headers })
  const compressed = await serverPhase("compression", () => compress(bytes, { level: constants.Z_BEST_SPEED }))
  headers.set("Content-Encoding", "gzip")
  return new Response(new Uint8Array(compressed), { headers })
}
