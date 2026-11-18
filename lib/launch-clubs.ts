import { prisma } from "@/utils/prisma"
import { DEFAULT_SCHOOL } from "@/lib/school-host"

export type LaunchClub = { id: string; name: string; logoUrl: string | null; color?: string | null; marketing?: unknown }

/** One school's approved launch participants (Club.schoolId; the cache key includes the argument). */
export async function getLaunchClubs(schoolId: string = DEFAULT_SCHOOL.id): Promise<LaunchClub[]> {
  try {
    return await prisma.club.findMany({
      where: { schoolId, marketingApprovedAt: { not: null } },
      select: { id: true, name: true, logoUrl: true, color: true, marketing: true },
      orderBy: { name: "asc" },
    })
  } catch {
    // Fail closed, including while the opt-in migration is being rolled out.
    return []
  }
}
