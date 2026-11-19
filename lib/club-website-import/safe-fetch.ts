import { lookup as dnsLookup, type LookupAddress } from "node:dns"
import http from "node:http"
import https from "node:https"
import { BlockList, isIP } from "node:net"
import zlib from "node:zlib"

/**
 * A guarded GET for pages and images on the public internet, used by the club website import.
 *
 * Only http(s) on the default ports, no credentials in the URL, and every address the host
 * resolves to must be public. The check runs inside the socket's own DNS lookup, so the address
 * that is checked is the address that is connected to (no DNS-rebinding gap), and it runs again
 * on every redirect. Responses are capped in time and in bytes, before and after decompression.
 */

export class SafeFetchError extends Error {
  constructor(message: string, readonly code: "INVALID_URL" | "BLOCKED_ADDRESS" | "TIMEOUT" | "TOO_LARGE" | "HTTP_STATUS" | "WRONG_TYPE" | "TOO_MANY_REDIRECTS" | "NETWORK", readonly status?: number) {
    super(message)
    this.name = "SafeFetchError"
  }
}

const blocked = new BlockList()
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(network, prefix, "ipv4")
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["::", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 23], ["2001:db8::", 32],
  ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(network, prefix, "ipv6")

/** True when an address is loopback, private, link-local, shared, reserved, documentation or multicast. */
export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "").split("%")[0]
  const family = isIP(bare)
  if (family === 4) return blocked.check(bare, "ipv4")
  if (family !== 6) return true
  const mapped = /^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/i.exec(bare)
  if (mapped) return blocked.check(mapped[1], "ipv4")
  const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(bare)
  if (hexMapped) {
    const [high, low] = [parseInt(hexMapped[1], 16), parseInt(hexMapped[2], 16)]
    return blocked.check([high >> 8, high & 255, low >> 8, low & 255].join("."), "ipv4")
  }
  return blocked.check(bare, "ipv6")
}

const blockedHostSuffixes = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home.arpa", ".corp", ".private"]

/** Parses and checks a URL before any network access. Throws SafeFetchError("INVALID_URL" | "BLOCKED_ADDRESS"). */
export function assertPublicHttpUrl(value: string | URL): URL {
  let url: URL
  try { url = new URL(String(value).trim()) } catch { throw new SafeFetchError("Use a full website link that starts with https://.", "INVALID_URL") }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SafeFetchError("Use a website link that starts with https://.", "INVALID_URL")
  if (url.username || url.password) throw new SafeFetchError("Remove the username or password from the link.", "INVALID_URL")
  if (url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) throw new SafeFetchError("Use a website link without a custom port.", "INVALID_URL")
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  if (!host) throw new SafeFetchError("Use a full website link.", "INVALID_URL")
  if (isIP(host.replace(/^\[|\]$/g, ""))) {
    if (isBlockedAddress(host)) throw new SafeFetchError("That address is not a public website.", "BLOCKED_ADDRESS")
  } else if (host === "localhost" || !host.includes(".") || blockedHostSuffixes.some(suffix => host.endsWith(suffix))) {
    throw new SafeFetchError("That address is not a public website.", "BLOCKED_ADDRESS")
  }
  url.hash = ""
  return url
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void
type Resolver = (hostname: string, options: { all: true }, callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void) => void

/** A socket lookup that refuses a host when any of its addresses is not public. */
export function publicOnlyLookup(resolve: Resolver = dnsLookup as unknown as Resolver) {
  return (hostname: string, options: { all?: boolean } | number | undefined, callback: LookupCallback) => {
    resolve(hostname, { all: true }, (error, addresses) => {
      if (error) return callback(error, "")
      if (!addresses.length || addresses.some(entry => isBlockedAddress(entry.address))) {
        const refused = Object.assign(new Error("Address is not public."), { code: "EBLOCKED" }) as NodeJS.ErrnoException
        return callback(refused, "")
      }
      if (typeof options === "object" && options?.all) return callback(null, addresses)
      callback(null, addresses[0].address, addresses[0].family)
    })
  }
}

export type SafeFetchOptions = {
  /** Accepted media types, compared against the response's Content-Type without parameters. */
  accept: readonly string[]
  maxBytes: number
  timeoutMs?: number
  maxRedirects?: number
  /** Request header Accept. */
  acceptHeader?: string
  /** Replaces the transport in tests. */
  request?: typeof https.request
}
export type SafeFetchResult = { url: URL; status: number; contentType: string; charset: string | null; body: Buffer }

const USER_AGENT = "Mozilla/5.0 (compatible; OutClassClubImport/1.0; +https://out-class.net)"

function decoder(encoding: string | undefined, maxBytes: number) {
  const options = { maxOutputLength: maxBytes }
  switch ((encoding || "identity").trim().toLowerCase()) {
    case "gzip": case "x-gzip": return zlib.createGunzip(options)
    case "deflate": return zlib.createInflate(options)
    case "br": return zlib.createBrotliDecompress(options)
    case "identity": case "": return null
    default: throw new SafeFetchError("The website sent the page in a format OutClass can't read.", "WRONG_TYPE")
  }
}

function once(url: URL, options: SafeFetchOptions, signal: AbortSignal): Promise<{ status: number; location?: string; contentType: string; charset: string | null; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const transport = options.request ?? (url.protocol === "https:" ? https.request : http.request)
    const request = transport(url, {
      method: "GET", signal, lookup: publicOnlyLookup() as never, agent: false,
      headers: { "user-agent": USER_AGENT, accept: options.acceptHeader ?? options.accept.join(", "), "accept-encoding": "gzip, deflate, br", "accept-language": "en-US,en;q=0.8" },
    }, response => {
      const status = response.statusCode ?? 0
      if (status >= 300 && status < 400 && response.headers.location) { response.resume(); return resolve({ status, location: response.headers.location, contentType: "", charset: null, body: Buffer.alloc(0) }) }
      if (status < 200 || status >= 300) { response.resume(); return reject(new SafeFetchError(`The website answered with status ${status}.`, "HTTP_STATUS", status)) }
      const rawType = String(response.headers["content-type"] ?? "")
      const contentType = rawType.split(";")[0].trim().toLowerCase()
      if (!options.accept.includes(contentType)) { response.resume(); return reject(new SafeFetchError("That link isn't a web page OutClass can read.", "WRONG_TYPE")) }
      const declared = Number(response.headers["content-length"])
      if (Number.isFinite(declared) && declared > options.maxBytes) { response.resume(); return reject(new SafeFetchError("That page is too large to import.", "TOO_LARGE")) }
      const charset = /charset\s*=\s*"?([\w.:-]+)/i.exec(rawType)?.[1]?.toLowerCase() ?? null
      let stream: NodeJS.ReadableStream = response
      try { const unzip = decoder(String(response.headers["content-encoding"] ?? ""), options.maxBytes); if (unzip) stream = response.pipe(unzip) } catch (error) { response.resume(); return reject(error) }
      const chunks: Buffer[] = []; let received = 0, raw = 0
      response.on("data", (chunk: Buffer) => { raw += chunk.length; if (raw > options.maxBytes) request.destroy(new SafeFetchError("That page is too large to import.", "TOO_LARGE")) })
      stream.on("data", (chunk: Buffer) => {
        received += chunk.length
        if (received > options.maxBytes) { request.destroy(new SafeFetchError("That page is too large to import.", "TOO_LARGE")); return }
        chunks.push(chunk)
      })
      stream.on("error", (error: NodeJS.ErrnoException) => reject(error?.code === "ERR_BUFFER_TOO_LARGE" ? new SafeFetchError("That page is too large to import.", "TOO_LARGE") : error))
      stream.on("end", () => resolve({ status, contentType, charset, body: Buffer.concat(chunks) }))
    })
    request.on("error", reject)
    request.end()
  })
}

function translate(error: unknown): SafeFetchError {
  if (error instanceof SafeFetchError) return error
  const code = (error as NodeJS.ErrnoException)?.code
  const name = (error as Error)?.name
  if (code === "EBLOCKED") return new SafeFetchError("That address is not a public website.", "BLOCKED_ADDRESS")
  if (name === "AbortError" || code === "ABORT_ERR" || code === "ETIMEDOUT") return new SafeFetchError("The website took too long to answer.", "TIMEOUT")
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return new SafeFetchError("OutClass couldn't find that website. Check the link.", "NETWORK")
  return new SafeFetchError("OutClass couldn't reach that website.", "NETWORK")
}

/** GETs a public URL, following up to `maxRedirects` redirects, each re-checked. */
export async function safeFetch(input: string | URL, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const signal = AbortSignal.timeout(options.timeoutMs ?? 8000)
  let url = assertPublicHttpUrl(input)
  for (let hop = 0; hop <= (options.maxRedirects ?? 4); hop++) {
    let answer: Awaited<ReturnType<typeof once>>
    try { answer = await once(url, options, signal) } catch (error) { throw translate(signal.aborted ? Object.assign(new Error(), { name: "AbortError" }) : error) }
    if (answer.location === undefined) return { url, status: answer.status, contentType: answer.contentType, charset: answer.charset, body: answer.body }
    let next: URL
    try { next = new URL(answer.location, url) } catch { throw new SafeFetchError("The website redirected to an invalid link.", "INVALID_URL") }
    url = assertPublicHttpUrl(next)
  }
  throw new SafeFetchError("The website redirected too many times.", "TOO_MANY_REDIRECTS")
}
