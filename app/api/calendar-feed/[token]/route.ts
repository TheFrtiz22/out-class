import { prisma } from "@/utils/prisma"
import { calendarFeedEvents } from "@/utils/calendar-feed"
import { calendarFeedFile } from "@/lib/ical"
import { calendarFeedTokenHash, isCalendarFeedToken } from "@/lib/calendar-feed"

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" }

/** Calendar apps fetch this without cookies; the unguessable token is the credential. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const raw = (await params).token.replace(/\.ics$/, "")
  if (!isCalendarFeedToken(raw)) return new Response("Not found", { status: 404, headers: privateHeaders })
  const tokenHash = calendarFeedTokenHash(raw)
  try {
    // Look the hash up first, outside any transaction: a flood of well-formed but unknown tokens costs one
    // indexed read each and never opens an interactive transaction.
    const feed = await prisma.calendarFeedToken.findUnique({ where: { tokenHash }, select: { userId: true, lastUsedAt: true, user: { select: { disabledAt: true } } } })
    if (!feed || feed.user.disabledAt) return new Response("Not found", { status: 404, headers: privateHeaders })
    const body = await prisma.$transaction(async tx => calendarFeedFile("OutClass", await calendarFeedEvents(tx, feed.userId)), { timeout: 20000 })
    // Record use at most hourly, in its own short write after the reads, so a calendar poll never holds the
    // token row while the feed is built (a "new link" or "turn off" by the same user doesn't wait behind it).
    if (!feed.lastUsedAt || Date.now() - +feed.lastUsedAt > 3600000) await prisma.calendarFeedToken.updateMany({ where: { tokenHash }, data: { lastUsedAt: new Date() } }).catch(() => console.warn("calendar-feed: lastUsedAt update failed"))
    return new Response(body, { headers: { ...privateHeaders, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="outclass.ics"' } })
  } catch {
    return new Response("Calendar unavailable", { status: 503, headers: privateHeaders })
  }
}
