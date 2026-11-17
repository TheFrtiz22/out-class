"use server"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { activeMemberWhere } from "@/lib/permissions"
import { ActionError, actionResult } from "@/lib/action-result"

const panelApprovalRequestPrefix = "interview-panel-approval:"

/**
 * A scheduler without owner rights asks the club's owners to confirm the interviewers they assigned.
 * Each owner gets one in-app notice per draft and revision; asking again for the same one sends nothing new, while a
 * discarded and recreated draft (whose revision starts over at 1) gets its own notice.
 */
export async function requestPanelApproval(raw: unknown) {
  return actionResult(() => requestPanelApprovalCommand(raw), "requestPanelApproval")
}

async function requestPanelApprovalCommand(raw: unknown) {
  const input = z.object({ clubId: z.string().uuid(), roundId: z.string().uuid() }).strict().parse(raw)
  const { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"])
    const proposal = await tx.interviewPanelProposal.findUnique({ where: { roundId_clubId: { roundId: input.roundId, clubId: input.clubId } }, select: { id: true, revision: true } })
    if (!proposal) throw new ActionError("Assign interviewers first, then ask an owner to confirm them.")
    const round = await tx.pipelineRound.findFirst({ where: { id: input.roundId, clubId: input.clubId }, select: { name: true } })
    const owners = await tx.clubMember.findMany({ where: { clubId: input.clubId, isOwner: true, userId: { not: user.id }, ...activeMemberWhere, user: { disabledAt: null } }, select: { userId: true, user: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } })
    if (!owners.length) throw new ActionError("This club has no other owner to confirm interviewers. Ask your president to add one.")
    const asker = (await tx.user.findUnique({ where: { id: user.id }, select: { studentProfile: { select: { firstName: true, lastName: true } } } }))?.studentProfile
    await tx.userNotification.createMany({ data: owners.map(o => ({ userId: o.userId, clubId: input.clubId, type: "INTERVIEW", eventKey: `${panelApprovalRequestPrefix}${input.roundId}:${proposal.id}:${proposal.revision}`, title: "Confirm interviewers", body: `${asker ? `${asker.firstName} ${asker.lastName}` : "A club leader"} assigned interviewers for ${round?.name || "an interview round"}. Confirm them so the schedule can be published.`, href: `/club/${input.clubId}/workspace?section=recruitment&tool=interviews&interviewTab=schedule&roundId=${input.roundId}&schedule=review` })), skipDuplicates: true })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, targetId: input.roundId, action: "interview.panels.approval_requested", details: { revision: proposal.revision, owners: owners.length } } })
    return { owners: owners.map(o => o.user.studentProfile ? `${o.user.studentProfile.firstName} ${o.user.studentProfile.lastName}` : "Club owner") }
  })
}
