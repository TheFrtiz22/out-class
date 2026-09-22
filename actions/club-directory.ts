"use server"

import { prisma } from "@/utils/prisma"
import type { DirectoryClub } from "@/lib/club-directory"

// Explicit public fields only: no applicants, emails, memberships, or evaluations.
const publicFields = {
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
    acceptanceRate: club.acceptanceRate,
    aumValue: club.aumValue,
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
