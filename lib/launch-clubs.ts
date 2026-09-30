import { prisma } from "@/utils/prisma"

export type LaunchClub = { id: string; name: string; logoUrl: string | null }

export async function getLaunchClubs(): Promise<LaunchClub[]> {
  try {
    return await prisma.club.findMany({
      where: { campusKey: "uva", marketingApprovedAt: { not: null } },
      select: { id: true, name: true, logoUrl: true },
      orderBy: { name: "asc" },
    })
  } catch {
    // Fail closed, including while the opt-in migration is being rolled out.
    return []
  }
}
