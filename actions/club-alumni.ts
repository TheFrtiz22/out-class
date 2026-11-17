"use server"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { ActionError, actionResult } from "@/lib/action-result"
import { assertClubOperational } from "@/lib/club-suspension"
import { isActiveMembership } from "@/lib/permissions"
import { ALUMNI_PAGE_SIZE, alumniDirectoryWhere, presentAlumnus } from "@/lib/club-alumni"

const inputSchema = z.object({ clubId: z.string().uuid(), page: z.number().int().min(0).max(1000).default(0) }).strict()

/**
 * A club's Alumni tab: recent alumni (most recent first, paginated) with name, email, employer,
 * role and class year. Only a current member of that club may read it (not alumni, applicants,
 * other clubs or signed-out visitors), and not from a support (view-as) session, because the list
 * is contact information shared with members. Alumni who opted out (alumniDirectoryVisible) and
 * disabled or deleted accounts are left out. Phone numbers are never read.
 */
async function listClubAlumniCommand(input: unknown) {
  const { clubId, page } = inputSchema.parse(input ?? {})
  const { user, impersonation } = await requireAuth()
  if (impersonation) throw new ActionError("Club alumni contacts aren’t shown in support sessions.", "FORBIDDEN")
  const membership = await prisma.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } }, select: { status: true, alumniSince: true } })
  if (!isActiveMembership(membership)) throw new ActionError("Only current members of this club can see its alumni.", "FORBIDDEN")
  await assertClubOperational(prisma, clubId)
  const where = alumniDirectoryWhere(clubId)
  const [total, rows] = await Promise.all([
    prisma.clubMember.count({ where }),
    prisma.clubMember.findMany({
      where,
      orderBy: [{ alumniSince: "desc" }, { id: "asc" }],
      skip: page * ALUMNI_PAGE_SIZE,
      take: ALUMNI_PAGE_SIZE,
      select: {
        id: true, alumniSince: true,
        user: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true, gradYear: true, postGradEmployer: true, postGradRole: true } } } },
      },
    }),
  ])
  return { alumni: rows.map(presentAlumnus), page, pageSize: ALUMNI_PAGE_SIZE, total }
}

export async function listClubAlumni(input: unknown) {
  return actionResult(() => listClubAlumniCommand(input), "listClubAlumni")
}
