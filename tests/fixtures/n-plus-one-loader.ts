// Control for tests/loader-query-count.test.cjs: a per-row query the harness must detect.
import { prisma } from "@/utils/prisma"

export async function perClubMeetings() {
  const clubs = await prisma.club.findMany()
  for (const club of clubs) await prisma.meeting.findMany({ where: { clubId: club.id } })
}
