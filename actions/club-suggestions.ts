"use server"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { suggestClubs } from "@/lib/club-suggestions"

/** Club IDs to suggest on Explore, from the student's own activity only. */
export async function getClubSuggestions(): Promise<string[]> {
  const { user } = await requireAuth()
  const [saved, applied, joined, attended] = await Promise.all([
    prisma.corkboardClub.findMany({ where: { userId: user.id }, select: { club: { select: { id: true, category: true } } } }),
    prisma.application.findMany({ where: { studentId: user.id, status: { not: "DRAFTING" } }, select: { club: { select: { id: true, category: true } } } }),
    prisma.clubMember.findMany({ where: { userId: user.id, status: "ACTIVE" }, select: { club: { select: { id: true, category: true } } } }),
    prisma.eventAttendance.findMany({ where: { studentId: user.id }, select: { event: { select: { club: { select: { id: true, category: true } } } } }, take: 100 }),
  ])
  const signals = [...saved, ...applied, ...joined].map(r => ({ clubId: r.club.id, category: r.club.category }))
    .concat(attended.map(r => ({ clubId: r.event.club.id, category: r.event.club.category })))
  if (!signals.length) return []
  const now = new Date()
  const candidates = await prisma.club.findMany({
    where: { isDiscoverable: true, suspendedAt: null, category: { in: [...new Set(signals.map(s => s.category))], mode: "insensitive" } },
    select: { id: true, name: true, category: true, applicationOpen: true, applicationDeadline: true },
    take: 200,
  })
  return suggestClubs(candidates.map(c => ({ id: c.id, name: c.name, category: c.category, recruiting: c.applicationOpen && (!c.applicationDeadline || c.applicationDeadline > now) })), signals)
}
