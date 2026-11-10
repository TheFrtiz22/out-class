import { createHash, randomBytes } from "node:crypto"
import { OUTLOOK_BUSY_MESSAGE, weekWindow, type BusyInterval } from "@/lib/outlook-busy"
import { localParts } from "@/lib/availability"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"

/**
 * One-time, read-only Outlook busy-time lookup for the availability editor.
 * The Microsoft access token lives only for the callback request: it is never
 * stored, logged or returned, and no refresh token is requested.
 */
type Env = Record<string, string | undefined>
type Fetcher = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "json">>

export const OUTLOOK_COOKIE = "oc-outlook-busy"
export const OUTLOOK_COOKIE_PATH = "/api/calendar/outlook"
export const OUTLOOK_SCOPE = "https://graph.microsoft.com/Calendars.ReadBasic"
const MAX_PAGES = 5
/** Free and working-elsewhere time does not block interviews. */
const BLOCKING = new Set(["busy", "tentative", "oof", "unknown"])

/**
 * The tenant is required: it limits sign-in to the university's own Microsoft
 * accounts, so another school's or employer's calendar cannot be imported.
 */
export function outlookConfig(env: Env = process.env) {
  const clientId = env.MICROSOFT_CALENDAR_CLIENT_ID, clientSecret = env.MICROSOFT_CALENDAR_CLIENT_SECRET, tenant = env.MICROSOFT_CALENDAR_TENANT
  if (env.NEXT_PUBLIC_OUTLOOK_CALENDAR_ENABLED !== "true" || !clientId || !clientSecret || !tenant) return null
  if (!/^[A-Za-z0-9.-]{1,100}$/.test(tenant) || ["common", "organizations", "consumers"].includes(tenant.toLowerCase())) return null
  return { clientId, clientSecret, tenant }
}

/**
 * Microsoft only accepts registered redirect URIs. Production uses the canonical
 * site; other environments use their own origin (register them separately).
 */
export function redirectOrigin(requestOrigin: string, env: Env = process.env) {
  if (env.VERCEL_ENV !== "production") return requestOrigin
  try { return new URL(env.OUTCLASS_SITE_URL || "").origin === requestOrigin ? requestOrigin : null } catch { return null }
}

const base64url = (bytes: Buffer) => bytes.toString("base64url")
export function pkce() {
  const verifier = base64url(randomBytes(32))
  return { state: base64url(randomBytes(24)), verifier, challenge: base64url(createHash("sha256").update(verifier).digest()) }
}

export function authorizeUrl(config: { clientId: string; tenant: string }, { redirectUri, state, challenge, loginHint }: { redirectUri: string; state: string; challenge: string; loginHint?: string }) {
  const url = new URL(`https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/authorize`)
  url.search = new URLSearchParams({
    client_id: config.clientId, response_type: "code", response_mode: "query", redirect_uri: redirectUri,
    scope: OUTLOOK_SCOPE, state, code_challenge: challenge, code_challenge_method: "S256",
    ...(loginHint ? { login_hint: loginHint } : {}),
  }).toString()
  return url.toString()
}

export type PendingLookup = { state: string; verifier: string; week: string; nonce: string; userId: string; expires: number }
export function parsePending(raw: string | undefined, now = Date.now()): PendingLookup | null {
  if (!raw || raw.length > 2000) return null
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== "object") return null
    const { state, verifier, week, nonce, userId, expires } = value
    if (![state, verifier, week, nonce, userId].every(item => typeof item === "string" && item.length > 0 && item.length <= 200)) return null
    if (typeof expires !== "number" || expires < now) return null
    return { state, verifier, week, nonce, userId, expires }
  } catch { return null }
}

/** Microsoft returns UTC wall time without a zone when asked for outlook.timezone="UTC". */
function utc(value: unknown) {
  if (typeof value !== "string") return NaN
  return +new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`)
}

/** The instant a calendar date begins in the scheduling zone (EST or EDT). */
export function zonedMidnight(date: string, zone = SCHEDULING_TIMEZONE) {
  for (const hour of [4, 5, 3, 6]) {
    const instant = +new Date(`${date}T0${hour}:00:00Z`)
    const parts = localParts(instant, zone)
    if (parts.date === date && parts.minute === 0) return instant
  }
  return NaN
}

/**
 * All-day events are calendar dates, not instants: Graph reports them as UTC
 * midnights, which would land on the previous evening in Eastern time.
 */
export function busyFromEvents(events: unknown[], zone = SCHEDULING_TIMEZONE): BusyInterval[] {
  const result: BusyInterval[] = []
  for (const event of events) {
    if (!event || typeof event !== "object") continue
    const { isCancelled, isAllDay, showAs, start, end } = event as { isCancelled?: unknown; isAllDay?: unknown; showAs?: unknown; start?: { dateTime?: unknown }; end?: { dateTime?: unknown } }
    if (isCancelled === true || !BLOCKING.has(String(showAs ?? "busy"))) continue
    const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ""
    const from = isAllDay === true ? zonedMidnight(date(start?.dateTime), zone) : utc(start?.dateTime)
    const to = isAllDay === true ? zonedMidnight(date(end?.dateTime), zone) : utc(end?.dateTime)
    if (Number.isFinite(from) && Number.isFinite(to) && to > from) result.push([from, to])
  }
  return result
}

/** Clip to the lookup window and merge overlaps, so a busy calendar stays a small message. */
export function compactBusy(busy: BusyInterval[], window: { start: Date; end: Date }): BusyInterval[] {
  const clipped = busy.map(([a, b]) => [Math.max(a, +window.start), Math.min(b, +window.end)] as BusyInterval).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  const merged: BusyInterval[] = []
  for (const [a, b] of clipped) {
    const last = merged.at(-1)
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }
  return merged
}

export async function lookupBusy({ config, code, verifier, redirectUri, week, fetcher = fetch }: {
  config: { clientId: string; clientSecret: string; tenant: string }; code: string; verifier: string; redirectUri: string; week: string; fetcher?: Fetcher
}): Promise<BusyInterval[]> {
  const tokenResponse = await fetcher(`https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({
      client_id: config.clientId, client_secret: config.clientSecret, grant_type: "authorization_code",
      code, redirect_uri: redirectUri, code_verifier: verifier, scope: OUTLOOK_SCOPE,
    }),
  })
  const token = tokenResponse.ok ? (await tokenResponse.json() as { access_token?: unknown }).access_token : null
  if (typeof token !== "string" || !token) throw new Error("token")
  const { start, end } = weekWindow(week)
  let next: string | null = `https://graph.microsoft.com/v1.0/me/calendarView?${new URLSearchParams({
    startDateTime: start.toISOString(), endDateTime: end.toISOString(),
    $select: "start,end,showAs,isCancelled,isAllDay", $top: "200",
  })}`
  const events: unknown[] = []
  for (let page = 0; next && page < MAX_PAGES; page++) {
    if (!next.startsWith("https://graph.microsoft.com/")) throw new Error("page")
    const response = await fetcher(next, {
      cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
    })
    if (!response.ok) throw new Error("calendar")
    const body = await response.json() as { value?: unknown; "@odata.nextLink"?: unknown }
    if (Array.isArray(body.value)) events.push(...body.value)
    next = typeof body["@odata.nextLink"] === "string" ? body["@odata.nextLink"] : null
  }
  // Never report "no conflicts" from a partial calendar.
  if (next) throw new Error("too many events")
  const busy = compactBusy(busyFromEvents(events), { start, end })
  if (busy.length > 500) throw new Error("too many events")
  return busy
}

/**
 * The popup hands its result to the editor that opened it (same origin only)
 * and closes. JSON is escaped so event data can never end the script element.
 */
export function popupResult(origin: string, payload: { nonce: string; week: string; busy?: BusyInterval[]; error?: string }) {
  const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
  const message = { type: OUTLOOK_BUSY_MESSAGE, ...payload }
  const text = payload.error ? "Outlook couldn’t be checked. Return to OutClass to try again." : "Outlook checked. Return to OutClass."
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>OutClass</title></head><body style="font:15px system-ui,sans-serif;margin:2rem;color:#1f1d1a;background:#faf8f4"><p role="status">${text} You can close this window.</p><script>(function(){try{if(window.opener){window.opener.postMessage(${json(message)},${json(origin)});window.close()}}catch(e){}})()</script></body></html>`
}
