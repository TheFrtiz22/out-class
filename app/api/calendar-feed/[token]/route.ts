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
    const body = await prisma.$transaction(async tx => {
      const feed = await tx.calendarFeedToken.findUnique({ where: { tokenHash }, select: { userId: true, lastUsedAt: true, user: { select: { disabledAt: true } } } })
      if (!feed || feed.user.disabledAt) return null
      // Record use at most hourly so a polling calendar app doesn't write on every fetch.
      if (!feed.lastUsedAt || Date.now() - +feed.lastUsedAt > 3600000) await tx.calendarFeedToken.update({ where: { tokenHash }, data: { lastUsedAt: new Date() } })
      return calendarFeedFile("OutClass", await calendarFeedEvents(tx, feed.userId))
    }, { timeout: 20000 })
    if (body === null) return new Response("Not found", { status: 404, headers: privateHeaders })
    return new Response(body, { headers: { ...privateHeaders, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="outclass.ics"' } })
  } catch {
    return new Response("Calendar unavailable", { status: 503, headers: privateHeaders })
  }
}
