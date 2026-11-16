import { activeMemberWhere } from "@/lib/permissions";
import { SCHEDULING_TIMEZONE, SCHEDULING_TIMEZONE_LABEL } from "@/lib/scheduling-config"
import { createHash } from "node:crypto"
import type { AppTransactionClient } from "@/utils/prisma"
import { interviewCapabilities } from "@/lib/interview-access"
import { publishedPanelDocumentSchema, type PanelScheduleChange } from "@/lib/panel-proposals"
export const panelScheduleNotificationPrefix="panel-schedule:"
export type OwnPanelAssignment={id:string;clubId:string;clubName:string;roundId:string;roundName:string;roomName:string;location:string;timezone:string;startTime:string;endTime:string;buffer:number;version:number;availabilityOverridden?:boolean}
/** Current official slot projection only. No drafts, applicant identities or other clubs' private panels. */
export async function ownPanelAssignments(tx:AppTransactionClient,userId:string,includeAnonymous=false):Promise<OwnPanelAssignment[]>{
 const members=await tx.clubMember.findMany({where:{userId,...activeMemberWhere,club:{suspendedAt:null},user:{disabledAt:null}},include:{club:{select:{name:true}}}})
 const allowed=members.filter(m=>interviewCapabilities(m).participate),ids=allowed.map(m=>m.id)
 if(!ids.length)return[]
 const owners=await tx.clubMember.findMany({where:{clubId:{in:allowed.map(m=>m.clubId)},isOwner:true,...activeMemberWhere,user:{disabledAt:null}},select:{userId:true,clubId:true}})
 const ownerKeys=new Set(owners.map(o=>`${o.clubId}:${o.userId}`))
 const slots=await tx.interviewSlot.findMany({where:{room:{isOpen:true,round:{archivedAt:null,...(includeAnonymous?{}:{anonymousReview:false})}},OR:[{panelScheduleVersionId:{not:null},publishedPanelMemberIds:{hasSome:ids}},{panelScheduleVersionId:null,room:{panelApprovedBy:{not:null},approvedPanelMemberIds:{hasSome:ids}}}]},include:{panelScheduleVersion:true,room:{include:{round:{select:{id:true,name:true}}}}},orderBy:{startTime:"asc"}})
 return slots.flatMap(s=>{
  const room=s.room!,publisher=s.panelScheduleVersion?.publishedBy??room.panelApprovedBy,assigned=s.panelScheduleVersionId?s.publishedPanelMemberIds:room.approvedPanelMemberIds.filter(id=>room.panelMemberIds.includes(id))
  if(!publisher||!ownerKeys.has(`${room.clubId}:${publisher}`)||!allowed.some(m=>m.clubId===room.clubId&&assigned.includes(m.id)))return[]
  return[{id:s.id,clubId:room.clubId,clubName:allowed.find(m=>m.clubId===room.clubId)!.club.name,roundId:room.roundId,roundName:room.round.name,roomName:room.name,location:room.location,timezone:room.timezone,startTime:s.startTime.toISOString(),endTime:s.endTime.toISOString(),buffer:room.buffer,version:s.panelScheduleVersion?.version??0,availabilityOverridden:!!(s.panelScheduleVersion?.document as {assignments?:{slotId:string;memberId:string;availabilityOverrideId?:string}[]})?.assignments?.some(a=>a.slotId===s.id&&allowed.some(m=>m.id===a.memberId)&&a.availabilityOverrideId)}]
 })
}
export function panelScheduleLine(s:{roomName:string;timezone:string;startTime:string;endTime:string}){
 const date=new Intl.DateTimeFormat("en-US",{timeZone:SCHEDULING_TIMEZONE,weekday:"short",month:"short",day:"numeric",year:"numeric"}).format(new Date(s.startTime)),time=(value:string)=>new Intl.DateTimeFormat("en-US",{timeZone:SCHEDULING_TIMEZONE,hour:"numeric",minute:"2-digit",hour12:true}).format(new Date(value))
 return `${date} · ${s.roomName} · ${time(s.startTime)}–${time(s.endTime)} (${SCHEDULING_TIMEZONE_LABEL})`
}
type PanelScheduleVersionRow=Awaited<ReturnType<typeof findPanelScheduleVersions>>[number]
function findPanelScheduleVersions(tx:AppTransactionClient,ids:string[]){
 return tx.interviewPanelScheduleVersion.findMany({where:{id:{in:ids}},include:{round:{select:{name:true,anonymousReview:true,archivedAt:true}},publisher:{select:{disabledAt:true}}}})
}
/**
 * Per-request memo for resolving many panel-schedule notifications for one user (the Inbox page, a digest).
 * Without it each notification re-ran the member, version, owner and full assignment queries (Sentry N+1 on
 * GET /api/workspace?kind=notifications). Only reads are shared; every authorization check still runs per row.
 */
export type PanelScheduleLookups={members:Map<string,Promise<Awaited<ReturnType<AppTransactionClient["clubMember"]["findFirst"]>>>>;versions:Map<string,Promise<PanelScheduleVersionRow|null>>;owners:Map<string,Promise<boolean>>;own?:Promise<OwnPanelAssignment[]>}
export function panelScheduleLookups():PanelScheduleLookups{return{members:new Map(),versions:new Map(),owners:new Map()}}
/** Loads every referenced schedule version in one query. Rows keep their own club check in currentPanelScheduleNotification. */
export async function prefetchPanelScheduleVersions(tx:AppTransactionClient,lookups:PanelScheduleLookups,notifications:{eventKey:string|null}[]){
 const ids=[...new Set(notifications.flatMap(n=>n.eventKey?.startsWith(panelScheduleNotificationPrefix)?[n.eventKey.split(":")[1]]:[]).filter(id=>id&&!lookups.versions.has(id)))]
 if(!ids.length)return
 const rows=findPanelScheduleVersions(tx,ids)
 for(const id of ids){const version=rows.then(found=>found.find(v=>v.id===id)??null);version.catch(()=>{});lookups.versions.set(id,version)}
 await rows
}
function memo<T>(map:Map<string,Promise<T>>,key:string,load:()=>Promise<T>){let value=map.get(key);if(!value){value=load();map.set(key,value)}return value}
export async function currentPanelScheduleNotification(tx:AppTransactionClient,notification:{eventKey:string;clubId:string|null;href:string},userId:string,lookups:PanelScheduleLookups=panelScheduleLookups()){
 if(!notification.eventKey.startsWith(panelScheduleNotificationPrefix)||!notification.clubId)return null
 const [,versionId,memberId]=notification.eventKey.split(":")
 const member=await memo(lookups.members,`${notification.clubId}:${memberId}`,()=>tx.clubMember.findFirst({where:{id:memberId,clubId:notification.clubId!,userId,...activeMemberWhere,user:{disabledAt:null},club:{suspendedAt:null}}}))
 if(!member||!interviewCapabilities(member).participate)return null
 const found=await memo(lookups.versions,versionId,()=>findPanelScheduleVersions(tx,[versionId]).then(rows=>rows[0]??null))
 const version=found&&found.clubId===member.clubId?found:null
 if(!version||version.round.anonymousReview||version.round.archivedAt||version.publisher.disabledAt)return null
 if(!await memo(lookups.owners,`${member.clubId}:${version.publishedBy}`,async()=>!!await tx.clubMember.findFirst({where:{clubId:member.clubId,userId:version.publishedBy,isOwner:true,...activeMemberWhere,user:{disabledAt:null}},select:{id:true}})))return null
 const changes=(version.changes as PanelScheduleChange[]).filter(c=>c.memberId===member.id)
 const cancelled=changes.length>0&&changes.every(c=>c.kind==="REMOVED")
 lookups.own??=ownPanelAssignments(tx,userId)
 const own=(await lookups.own).filter(s=>s.clubId===member.clubId&&s.roundId===version.roundId&&+new Date(s.endTime)>Date.now())
 if(!cancelled&&!own.length)return null
 const lines=cancelled?changes.flatMap(c=>c.before?[`Cancelled: ${panelScheduleLine(c.before)}`]:[]):own.map(panelScheduleLine)
 const href=`/settings/interviews?clubId=${member.clubId}&roundId=${version.roundId}`,details=[...lines.slice(0,24),...(lines.length>24?[`${lines.length-24} more sessions are available in your interview schedule.`]:[])],signature=createHash("sha256").update(JSON.stringify({cancelled,lines})).digest("hex")
 // Parse the immutable document at this boundary; malformed history never produces mail.
 publishedPanelDocumentSchema.parse(version.document)
 return{title:`${cancelled?"Panel assignment cancelled":"Interview panel schedule"} · ${version.round.name}`,body:details.join("\n"),href,panelSchedule:{href,details,signature}}
}
