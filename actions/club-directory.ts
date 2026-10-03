"use server"

import { prisma } from "@/utils/prisma"
import type { DirectoryClub } from "@/lib/club-directory"

// Explicit public fields only: no applicants, emails, memberships, or evaluations.
const publicFields = {
  marketing: true,
  testRequirement: true,
  claimedAt: true,
  campusKey: true,
  directorySource: true,
  id: true,
  name: true,
  tagline: true,
  description: true,
  logoUrl: true,
  bannerUrl: true,
  category: true,
  color: true,
  acceptanceRate: true,
  aumValue: true,
  pipelineRounds: { select: { id: true }, take: 1 },
  questions: { where: { required: true }, select: { prompt: true } },
  events: {
    where: { isPublic: true },
    select: { id: true, title: true, date: true, location: true, description: true },
    orderBy: { date: "asc" as const },
  },
} as const
function present(club: Awaited<ReturnType<typeof readClubs>>[number]): DirectoryClub {
  return {
    marketing: club.marketing,
    testRequirement: club.testRequirement,
    claimed: !!club.claimedAt,
    campusKey: club.campusKey,
    directorySource: club.directorySource,
    id: club.id,
    name: club.name,
    logoText: club.name
      .split(/\s+/)
      .map((word) => word[0])
      .slice(0, 3)
      .join(""),
    logoUrl: club.logoUrl,
    bannerUrl: club.bannerUrl,
    color: club.color,
    category: club.category,
    pitch: club.tagline,
    description: club.description,
    tags: [],
    acceptanceRate: (club.marketing as { showAcceptance?: boolean } | null)?.showAcceptance === false ? null : club.acceptanceRate,
    aumValue: (club.marketing as { showAum?: boolean } | null)?.showAum === false ? null : club.aumValue,
    timeCommitment: null,
    source: "database",
    applicationAvailable: club.pipelineRounds.length > 0,
    requirements: club.questions.map((question) => question.prompt),
    publicEvents: club.events.map((event) => ({ ...event, date: event.date.toISOString() })),
  }
}
async function readClubs() {
  return prisma.club.findMany({ select: publicFields, orderBy: { name: "asc" } })
}
export async function getClubDirectory(): Promise<{ clubs: DirectoryClub[]; error?: string }> {
  try {
    return { clubs: (await readClubs()).map(present) }
  } catch {
    return { clubs: [], error: "We couldn’t load the club directory. Please try again." }
  }
}
export async function getPublicClub(
  id: string,
): Promise<{ club: DirectoryClub | null; error?: string }> {
  try {
    const club = await prisma.club.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: publicFields,
    })
    return { club: club ? present(club) : null }
  } catch {
    return { club: null, error: "We couldn’t load this club. Please try again." }
  }
}

/** Idempotent start: never replace answers or reset an existing application. */
export async function startClubApplication(clubId: string) {
  const { requireAuth } = await import("@/utils/auth")
  const { user } = await requireAuth()
  const existing = await prisma.application.findUnique({
    where: { studentId_clubId: { studentId: user.id, clubId } },
    select: { id: true },
  })
  if (existing) return { applicationId: existing.id }
  const round = await prisma.pipelineRound.findFirst({
    where: { clubId },
    orderBy: { order: "asc" },
  })
  if (!round) throw new Error("Applications are not available for this club.")
  const application = await prisma.application.upsert({
    where: { studentId_clubId: { studentId: user.id, clubId } },
    update: {},
    create: { studentId: user.id, clubId, roundId: round.id, status: "DRAFTING" },
    select: { id: true },
  })
  return { applicationId: application.id }
}

/** Personal saved items use the same public club projection as Explore. */
export async function getCorkboard() {
  const { requireAuth } = await import("@/utils/auth")
  const { user } = await requireAuth()
  const records = await prisma.corkboardClub.findMany({
    where: { userId: user.id },
    include: { club: { select: publicFields } },
    orderBy: [{ savedAt: "desc" }, { clubId: "asc" }],
  })
  return { items: records.map(record => ({ club: present(record.club), savedAt: record.savedAt.toISOString() })) }
}

/** Explicit idempotent state, rather than a toggle based on stale browser state. */
export async function setCorkboardClub(input: unknown) {
  const { corkboardInput } = await import("@/lib/corkboard")
  const data = corkboardInput.parse(input)
  const { requireAuth } = await import("@/utils/auth")
  const { user } = await requireAuth()
  if (!data.saved) {
    await prisma.corkboardClub.deleteMany({ where: { userId: user.id, clubId: data.clubId } })
    return { saved: false, savedAt: null }
  }
  const club = await prisma.club.findUnique({ where: { id: data.clubId }, select: { id: true } })
  if (!club) throw new Error("This club is no longer available.")
  const record = await prisma.corkboardClub.upsert({
    where: { userId_clubId: { userId: user.id, clubId: data.clubId } },
    create: { userId: user.id, clubId: data.clubId },
    update: {},
  })
  return { saved: true, savedAt: record.savedAt.toISOString() }
}
