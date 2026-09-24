"use server"

import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"

export type WorkspaceSearchResult = {
  id: string
  kind: "club" | "application" | "applicant" | "round"
  title: string
  detail: string
  clubId: string
}
export async function searchWorkspace(
  query: string,
  leader = false,
): Promise<WorkspaceSearchResult[]> {
  const { user } = await requireAuth()
  const text = query.trim().slice(0, 120)
  if (text.length < 2) return []
  const memberships = leader
    ? await prisma.clubMember.findMany({
        where: { userId: user.id, OR: [{ isOwner: true }, { permissions: { has: "applicants.identify" } }] },
        select: { clubId: true },
      })
    : []
  const clubIds = memberships.map((item) => item.clubId)
  const contains = { contains: text, mode: "insensitive" as const }
  const [clubs, applications, applicants, rounds] = await Promise.all([
    prisma.club.findMany({
      where: { OR: [{ name: contains }, { category: contains }] },
      select: { id: true, name: true, category: true },
      take: 6,
      orderBy: { name: "asc" },
    }),
    prisma.application.findMany({
      where: { studentId: user.id, club: { name: contains } },
      select: { id: true, clubId: true, status: true, club: { select: { name: true } } },
      take: 6,
    }),
    clubIds.length
      ? prisma.application.findMany({
          where: {
            clubId: { in: clubIds },
            status: { not: "DRAFTING" },
            round: { anonymousReview: false },
            student: {
              OR: [
                { email: contains },
                {
                  studentProfile: {
                    AND: text
                      .split(/\s+/)
                      .map((word) => ({
                        OR: [
                          { firstName: { contains: word, mode: "insensitive" as const } },
                          { lastName: { contains: word, mode: "insensitive" as const } },
                        ],
                      })),
                  },
                },
              ],
            },
          },
          select: {
            id: true,
            clubId: true,
            student: {
              select: {
                email: true,
                studentProfile: { select: { firstName: true, lastName: true } },
              },
            },
            club: { select: { name: true } },
          },
          take: 8,
        })
      : [],
    clubIds.length
      ? prisma.pipelineRound.findMany({
          where: { clubId: { in: clubIds }, name: contains },
          select: { id: true, clubId: true, name: true, club: { select: { name: true } } },
          take: 6,
          orderBy: { order: "asc" },
        })
      : [],
  ])
  return [
    ...clubs.map((club) => ({
      id: club.id,
      kind: "club" as const,
      title: club.name,
      detail: club.category,
      clubId: club.id,
    })),
    ...applications.map((app) => ({
      id: app.id,
      kind: "application" as const,
      title: app.club.name,
      detail: app.status.replaceAll("_", " ").toLowerCase(),
      clubId: app.clubId,
    })),
    ...applicants.map((app) => ({
      id: app.id,
      kind: "applicant" as const,
      title: app.student.studentProfile
        ? `${app.student.studentProfile.firstName} ${app.student.studentProfile.lastName}`
        : app.student.email,
      detail: app.club.name,
      clubId: app.clubId,
    })),
    ...rounds.map((round) => ({
      id: round.id,
      kind: "round" as const,
      title: round.name,
      detail: round.club.name,
      clubId: round.clubId,
    })),
  ]
}
