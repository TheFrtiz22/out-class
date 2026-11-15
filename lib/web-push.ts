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
