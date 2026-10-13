import type { AppTransactionClient } from "@/utils/prisma"
import { sessionsOverlap,type PanelBusyInterval } from "@/lib/panel-proposals"
/** Reused by legacy approvals and applicant booking so they cannot conflict with published session panels. */
export async function assertOfficialPanelConflicts(tx:AppTransactionClient,userIds:string[],targets:(PanelBusyInterval&{id:string;userIds?:string[]})[]){
 if(!userIds.length||!targets.length)return
 const memberships=await tx.clubMember.findMany({where:{userId:{in:userIds}},select:{id:true,userId:true}}),byMember=new Map(memberships.map(m=>[m.id,m.userId])),ids=memberships.map(m=>m.id)
 if(!memberships.length)return
 const start=Math.min(...targets.map(s=>+new Date(s.startTime)))-3600000,end=Math.max(...targets.map(s=>+new Date(s.endTime)))+3600000,interval={startTime:{lt:new Date(end)},endTime:{gt:new Date(start)}}
 const [slots,grants]=await Promise.all([
  tx.interviewSlot.findMany({where:{...interval,room:{isOpen:true},OR:[{panelScheduleVersionId:{not:null},publishedPanelMemberIds:{hasSome:ids}},{panelScheduleVersionId:null,room:{panelApprovedBy:{not:null},approvedPanelMemberIds:{hasSome:ids}}}]},include:{room:true}}),
  tx.interviewPanelAssignment.findMany({
    where:{revokedAt:null,member:{userId:{in:userIds}},application:{bookings:{some:{slot:interval}}}},
    include:{member:{select:{userId:true}},application:{include:{bookings:{where:{slot:interval},include:{slot:{include:{room:true}}}}}}}
  })
 ])
 const conflict=(userId:string,slot:{id:string;startTime:Date;endTime:Date;room?:{buffer:number}|null})=>targets.some(target=>(!target.userIds||target.userIds.includes(userId))&&target.id!==slot.id&&sessionsOverlap(target,{startTime:slot.startTime.toISOString(),endTime:slot.endTime.toISOString(),buffer:slot.room?.buffer??0}))
 if(slots.some(s=>(s.panelScheduleVersionId?s.publishedPanelMemberIds:s.room!.approvedPanelMemberIds.filter(id=>s.room!.panelMemberIds.includes(id))).some(id=>byMember.has(id)&&conflict(byMember.get(id)!,s))))throw new Error("An official interview panel commitment overlaps this time, including its buffer.")
 if(grants.some(g=>g.application.bookings.some(b=>b.roundId===g.roundId&&(!b.slot.panelScheduleVersionId||b.slot.publishedPanelMemberIds.includes(g.memberId))&&conflict(g.member.userId,b.slot))))throw new Error("An official interview panel commitment overlaps this time, including its buffer.")
}
