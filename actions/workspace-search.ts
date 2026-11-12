"use server"

import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { searchPublicClubIds } from "@/actions/typesense-search"

export type WorkspaceSearchResult = {
  id: string
  kind: "club" | "application" | "applicant" | "round"
  title: string
  detail: string
  clubId: string
}
/**
 * One search for the whole account, wherever it is opened: public clubs, the account's own applications, and the
 * applicants and rounds of every club whose membership allows identifying applicants. The server derives those
 * clubs from memberships on each call; nothing the browser sends widens access.
 * `_leader` is the retired "only search records from a club workspace" flag, still accepted from older clients.
 */
export async function searchWorkspace(
  query: string,
  _leader?: boolean,
): Promise<WorkspaceSearchResult[]> {
  const { user } = await requireAuth()
  const text = query.trim().slice(0, 120)
  if (text.length < 2) return []
  const memberships = await prisma.clubMember.findMany({
    where: { userId: user.id, status: "ACTIVE", OR: [{ isOwner: true }, { permissions: { has: "applicants.identify" } }] },
    select: { clubId: true },
  })
  const clubIds = memberships.map((item) => item.clubId)
  const contains = { contains: text, mode: "insensitive" as const }
  const typesenseClubIds = await searchPublicClubIds(text)
  const [clubs, applications, applicants, rounds] = await Promise.all([
    prisma.club.findMany({
      where: typesenseClubIds === null
        ? { isDiscoverable: true, suspendedAt: null, OR: [{ name: contains }, { category: contains }] }
        : { isDiscoverable: true, suspendedAt: null, id: { in: typesenseClubIds.slice(0, 250) } },
      select: { id: true, name: true, category: true },
      take: typesenseClubIds === null ? 6 : 250,
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
          where: { clubId: { in: clubIds }, archivedAt: null, name: contains },
          select: { id: true, clubId: true, name: true, club: { select: { name: true } } },
          take: 6,
          orderBy: { order: "asc" },
        })
      : [],
  ])
  const rankedClubs = typesenseClubIds === null ? clubs : [...clubs].sort((a, b) => typesenseClubIds.indexOf(a.id) - typesenseClubIds.indexOf(b.id)).slice(0, 6)
  return [
    ...rankedClubs.map((club) => ({
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
