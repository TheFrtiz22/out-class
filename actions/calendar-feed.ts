"use server"
import { headers } from "next/headers"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { calendarFeedTokenHash, calendarFeedUrls, newCalendarFeedToken } from "@/lib/calendar-feed"
import { SITE_URL } from "@/lib/seo"

async function origin() {
  const h = await headers(), host = h.get("x-forwarded-host") ?? h.get("host")
  return host && /^(localhost(:\d+)?|[a-z0-9.-]+\.(out-class\.net|vercel\.app))$/i.test(host) ? `${host.startsWith("localhost") ? "http" : "https"}://${host}` : SITE_URL
}

export async function getCalendarFeedStatus() {
  const { user } = await requireAuth()
  const feed = await prisma.calendarFeedToken.findUnique({ where: { userId: user.id }, select: { createdAt: true, lastUsedAt: true } })
  return { active: !!feed, createdAt: feed?.createdAt.toISOString() ?? null, lastUsedAt: feed?.lastUsedAt?.toISOString() ?? null }
}

/** Creates a new private link and invalidates any earlier one. The link is shown
 * once; it is not stored and cannot be read back. */
export async function createCalendarFeedLink() {
  const { user } = await requireAuth({ verifyEmail: true })
  const token = newCalendarFeedToken(), tokenHash = calendarFeedTokenHash(token)
  await prisma.$transaction(async tx => {
    await tx.calendarFeedToken.upsert({ where: { userId: user.id }, create: { userId: user.id, tokenHash }, update: { tokenHash, createdAt: new Date(), lastUsedAt: null } })
    await tx.auditLog.create({ data: { actorId: user.id, action: "calendar.feed.create", targetId: user.id } })
  })
  return calendarFeedUrls(await origin(), token)
}

export async function disableCalendarFeed() {
  const { user } = await requireAuth()
  await prisma.$transaction(async tx => {
    const { count } = await tx.calendarFeedToken.deleteMany({ where: { userId: user.id } })
    if (count) await tx.auditLog.create({ data: { actorId: user.id, action: "calendar.feed.disable", targetId: user.id } })
  })
  return { active: false }
}
