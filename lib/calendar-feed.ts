import { createHash, randomBytes } from "node:crypto"

/** 256-bit URL-safe secret. Only its SHA-256 digest is stored. */
export function newCalendarFeedToken() { return randomBytes(32).toString("base64url") }
export function calendarFeedTokenHash(token: string) { return createHash("sha256").update(token, "utf8").digest("hex") }
export function isCalendarFeedToken(value: string) { return /^[A-Za-z0-9_-]{43}$/.test(value) }
export function calendarFeedUrls(origin: string, token: string) {
  const https = `${origin.replace(/\/$/, "")}/api/calendar-feed/${token}`
  const webcal = https.replace(/^https?:/, "webcal:")
  return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` }
}
