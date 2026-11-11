import { createHash } from "node:crypto"
import { prisma } from "@/utils/prisma"
import { calendarFeedEvents } from "@/utils/calendar-feed"
import { calendarFeedFile } from "@/lib/ical"
import { calendarFeedTokenHash, isCalendarFeedToken } from "@/lib/calendar-feed"
import { RATE_LIMITS, limitRequest } from "@/lib/rate-limit"

// no-cache (not no-store): calendar apps may keep the file but must revalidate it, which the ETag answers cheaply.
const privateHeaders = { "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" }
const errorHeaders = { ...privateHeaders, "Cache-Control": "private, no-store" }

/** A built feed is reused for this long on the same instance, so a tight poll loop does not rebuild it. */
const FEED_REUSE_MS = 60_000
const builtFeeds = new Map<string, { body: string; etag: string; builtAt: number }>()
function remember(tokenHash: string, body: string) {
  const entry = { body, etag: `"${createHash("sha256").update(body).digest("base64url").slice(0, 27)}"`, builtAt: Date.now() }
  builtFeeds.delete(tokenHash)
  builtFeeds.set(tokenHash, entry)
  while (builtFeeds.size > 500) builtFeeds.delete(builtFeeds.keys().next().value as string)
  return entry
}

/** Calendar apps fetch this without cookies; the unguessable token is the credential. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const raw = (await params).token.replace(/\.ics$/, "")
  if (!isCalendarFeedToken(raw)) return new Response("Not found", { status: 404, headers: errorHeaders })
  const tokenHash = calendarFeedTokenHash(raw)
  const limited = limitRequest(request, RATE_LIMITS.calendarFeed, { key: `feed:${tokenHash}` })
  if (limited) return limited
  try {
    // Look the hash up first, outside any transaction: a flood of well-formed but unknown tokens costs one
    // indexed read each and never opens an interactive transaction. This runs on every request, so a
    // revoked link or disabled account stops working at once even while a built feed is being reused.
    const feed = await prisma.calendarFeedToken.findUnique({ where: { tokenHash }, select: { userId: true, lastUsedAt: true, user: { select: { disabledAt: true } } } })
    if (!feed || feed.user.disabledAt) {
      builtFeeds.delete(tokenHash)
      return new Response("Not found", { status: 404, headers: errorHeaders })
    }
    const cached = builtFeeds.get(tokenHash)
    const built = cached && Date.now() - cached.builtAt < FEED_REUSE_MS ? cached
      : remember(tokenHash, await prisma.$transaction(async tx => calendarFeedFile("OutClass", await calendarFeedEvents(tx, feed.userId)), { timeout: 20000 }))
    // Record use at most hourly, in its own short write after the reads, so a calendar poll never holds the
    // token row while the feed is built (a "new link" or "turn off" by the same user doesn't wait behind it).
    if (!feed.lastUsedAt || Date.now() - +feed.lastUsedAt > 3600000) await prisma.calendarFeedToken.updateMany({ where: { tokenHash }, data: { lastUsedAt: new Date() } }).catch(() => console.warn("calendar-feed: lastUsedAt update failed"))
    const headers = { ...privateHeaders, ETag: built.etag, "Last-Modified": new Date(built.builtAt).toUTCString() }
    if (request.headers.get("if-none-match") === built.etag) return new Response(null, { status: 304, headers })
    return new Response(built.body, { headers: { ...headers, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="outclass.ics"' } })
  } catch {
    return new Response("Calendar unavailable", { status: 503, headers: errorHeaders })
  }
}
