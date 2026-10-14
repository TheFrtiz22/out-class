import type {AppTransactionClient} from "@/utils/prisma";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
import {loadInterviewerPool} from "@/utils/interviewer-pool";
import {availabilityHref} from "@/lib/availability";
export async function activeAvailabilityRound(tx:AppTransactionClient,clubId:string,roundId:string){
 const round=await tx.pipelineRound.findFirst({where:{id:roundId,clubId,archivedAt:null},include:{_count:{select:{interviewRooms:true}}}});
 if(!round||!(round.type==="INTERVIEW"||/interview/i.test(round.name)||round._count.interviewRooms))throw Error("Choose an active interview round from this club.");return round;
}
export async function publishAvailabilityRequest(tx:AppTransactionClient,input:{clubId:string;roundId:string;memberIds:string[];reminder:boolean},senderId:string){
    await authorizeClubTransaction(tx, input.clubId, senderId, ["interviews.manage"])
    const round = await activeAvailabilityRound(tx, input.clubId, input.roundId)
    const club = await tx.club.findUniqueOrThrow({ where: { id: input.clubId }, select: { name: true } })
    const pool = await loadInterviewerPool(tx, input.clubId, input.roundId, input.memberIds)
    const targets = pool.members.filter(m => input.memberIds.includes(m.id))
    if (new Set(input.memberIds).size !== input.memberIds.length || targets.length !== input.memberIds.length || targets.some(m => !m.eligible || m.disabledAt)) throw new Error("Select eligible active interviewers from this club and round.")
    let sent = 0
    const now = new Date()
    for (const member of targets) {
      const key = { memberId: member.id, roundId: input.roundId }
      const old = await tx.interviewRoundParticipation.findUnique({ where: { memberId_roundId: key } })
      if (old?.confirmedAt || old?.declinedAt) continue
      if (input.reminder ? !old?.requestedAt || +now - +(old.lastReminderAt ?? old.requestedAt) < 86400000 : !!old?.requestedAt) continue
      const sequence = input.reminder ? (old?.reminderSequence ?? 0) + 1 : 0
      const saved = await tx.interviewRoundParticipation.upsert({ where: { memberId_roundId: key }, create: { ...key, clubId: input.clubId, requestedAt: now }, update: { ...(input.reminder ? { lastReminderAt: now, reminderSequence: sequence } : { requestedAt: now }), revision: { increment: 1 } } })
      await tx.userNotification.create({ data: { userId: member.userId, clubId: input.clubId, type: "INTERVIEW", eventKey: `availability-request:${saved.id}:${sequence}`, title: `${input.reminder ? "Reminder: " : ""}Availability requested · ${club.name}`, body: `Submit availability or decline participation for ${round.name}. Your global schedule will be prefilled.`, href: availabilityHref(input.clubId, input.roundId) } })
      sent++
    }
    await tx.auditLog.create({ data: { actorId: senderId, clubId: input.clubId, targetId: input.roundId, action: input.reminder ? "interview.availability.remind" : "interview.availability.request", details: { sent } } })
    return { sent }

}
