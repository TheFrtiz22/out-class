// Web Push (S1-8): configuration, subscription validation and the lock-screen payload.
// Pure so it can be unit-tested; utils/notification-push.ts sends, actions/push-subscriptions.ts stores.

/** Push is off unless all three VAPID variables are set. */
export function webPushConfig(env: Record<string, string | undefined> = process.env) {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim(), privateKey = env.VAPID_PRIVATE_KEY?.trim(), subject = env.VAPID_SUBJECT?.trim()
  if (!publicKey || !privateKey || !subject) return null
  if (!/^(mailto:|https:\/\/)/.test(subject)) return null
  return { publicKey, privateKey, subject }
}

// The server POSTs to the stored endpoint, so only real browser push services are accepted (no SSRF).
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/]
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string }

/** Validates a browser `PushSubscription.toJSON()`; returns null for anything else. */
export function parsePushSubscription(input: unknown): PushSubscriptionInput | null {
  if (!input || typeof input !== "object") return null
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  if (typeof endpoint !== "string" || endpoint.length > 2048 || !keys || typeof keys !== "object") return null
  const { p256dh, auth } = keys
  if (typeof p256dh !== "string" || typeof auth !== "string") return null
  if (!BASE64URL.test(p256dh) || p256dh.length > 200 || !BASE64URL.test(auth) || auth.length > 100) return null
  let url: URL
  try { url = new URL(endpoint) } catch { return null }
  if (url.protocol !== "https:" || url.port || url.username || url.password || !PUSH_HOSTS.some(host => host.test(url.hostname))) return null
  return { endpoint: url.href, p256dh, auth }
}

// Lock screens are visible to others, so the payload never carries the notification's own
// title or body (applicant names, decisions, message text). Only a category label, a club
// name for club-wide updates, and a same-origin path.
const TITLES: Record<string, string> = {
  ANNOUNCEMENT: "New club announcement", MESSAGE: "New message", APPLICATION: "Application update",
  DECISION: "Application update", OFFER_RESPONSE: "Application update", INTERVIEW: "Interview update",
  INVITATION: "Club invitation", TASK: "New task", PLATFORM: "OutClass update",
}
const CLUB_NAMED = new Set(["ANNOUNCEMENT", "INVITATION", "TASK"])

export type PushPayload = { title: string; body: string; url: string }

/** A same-origin path, or `/inbox` when the stored link is missing, absolute or unsafe. */
export function sameOriginPath(href: string | null | undefined) {
  if (!href || href.length > 512 || !href.startsWith("/") || href.startsWith("//") || href.includes("\\")) return "/inbox"
  try {
    const url = new URL(href, "https://outclass.invalid")
    return url.origin === "https://outclass.invalid" ? `${url.pathname}${url.search}` : "/inbox"
  } catch { return "/inbox" }
}

export function buildPushPayload(notification: { type: string; href?: string | null; club?: { name: string } | null }): PushPayload {
  const club = notification.club?.name?.trim().slice(0, 80)
  return {
    title: TITLES[notification.type] ?? "OutClass update",
    body: club && CLUB_NAMED.has(notification.type) ? `From ${club}` : "Open OutClass for details.",
    url: sameOriginPath(notification.href),
  }
}

/** Stop sending to a subscription after this many consecutive non-404/410 failures. */
export const PUSH_MAX_FAILURES = 5
/** A push older than this is no longer useful; it is skipped instead of sent late. */
export const PUSH_MAX_AGE_MS = 24 * 3600000
/** Per-user cap: the oldest subscription is dropped when a new device subscribes past it. */
export const PUSH_MAX_SUBSCRIPTIONS = 10

// Native push (the iOS/Android app): another channel of the same path. A device is one more
// subscription row (kind 'EXPO'), so preferences, currency checks and the at-most-once ledger
// are the web's. Sent through Expo's push service, which holds the APNs/FCM credentials.

export type PushPlatform = "IOS" | "ANDROID" | "OTHER"

/** Native push is off unless NATIVE_PUSH_ENABLED=1. EXPO_ACCESS_TOKEN is optional (Expo "enhanced security"). */
export function nativePushConfig(env: Record<string, string | undefined> = process.env) {
  if (env.NATIVE_PUSH_ENABLED?.trim() !== "1") return null
  const accessToken = env.EXPO_ACCESS_TOKEN?.trim() || null
  return { accessToken, url: "https://exp.host/--/api/v2/push/send" as const }
}

const EXPO_TOKEN = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/
const NATIVE_ENDPOINT_PREFIX = "expo:"

/** Validates what the app registers: an Expo push token and the device platform. */
export function parseNativePushDevice(input: unknown): { endpoint: string; platform: "IOS" | "ANDROID" } | null {
  if (!input || typeof input !== "object") return null
  const { token, platform } = input as { token?: unknown; platform?: unknown }
  if (typeof token !== "string" || !EXPO_TOKEN.test(token)) return null
  if (platform !== "IOS" && platform !== "ANDROID") return null
  return { endpoint: `${NATIVE_ENDPOINT_PREFIX}${token}`, platform }
}

/** The Expo push token stored in a native subscription's endpoint, or null if the row is not a valid one. */
export function nativePushToken(endpoint: string): string | null {
  if (!endpoint.startsWith(NATIVE_ENDPOINT_PREFIX)) return null
  const token = endpoint.slice(NATIVE_ENDPOINT_PREFIX.length)
  return EXPO_TOKEN.test(token) ? token : null
}

/** Where a browser subscription lives, from its User-Agent: a phone browser/installed web app, or anything else. */
export function pushPlatformFromUserAgent(userAgent: string | null | undefined): PushPlatform {
  const ua = userAgent ?? ""
  if (/iPhone|iPod/.test(ua)) return "IOS"
  if (/Android/.test(ua) && /Mobile/.test(ua)) return "ANDROID"
  return "OTHER"
}

/**
 * One push per event per device: a phone with the native app registered does not also get the
 * web push its browser or installed web app subscribed to. Web rows saved before platforms were
 * recorded (null) and non-phone rows always stay.
 */
export function pushRecipients<T extends { kind?: string | null; platform?: string | null }>(subscriptions: T[], enabled: { web: boolean; native: boolean }): T[] {
  const native = subscriptions.filter(row => row.kind === "EXPO" && enabled.native)
  const nativePlatforms = new Set(native.map(row => row.platform))
  const web = subscriptions.filter(row => row.kind !== "EXPO" && enabled.web && !(row.platform && row.platform !== "OTHER" && nativePlatforms.has(row.platform)))
  return [...web, ...native]
}
