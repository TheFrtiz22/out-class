"use server";
import {z} from "zod";
import {Prisma} from "@prisma/client";
import {requireClubPermission} from "@/utils/auth";
import {supportContext} from "@/utils/support-audit";
import {clubWriteTransaction} from "@/utils/club-write-transaction";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
import {resolveScheduleTime,requireFutureSchedule} from "@/lib/communication-schedule";
import {invitationScheduleInput,invitationScheduleSelection,invitationFingerprint} from "@/lib/invitation-schedule";
import {validateScheduledInvitations} from "@/utils/invitation-scheduling";
async function targets(tx:Parameters<Parameters<typeof clubWriteTransaction>[0]>[0],selection:z.infer<typeof invitationScheduleSelection>) {
 if(selection.importId){const record=await tx.rosterImport.findFirst({where:{id:selection.importId,clubId:selection.clubId,status:"COMPLETED"}});if(!record)throw Error("Reviewed import unavailable.");}
 const rows=await tx.clubInvitation.findMany({where:{clubId:selection.clubId,status:"PENDING",purpose:"ACCESS_GRANT",deliveries:{none:{status:{in:["QUEUED","SENDING"]}}},...(selection.invitationId?{id:selection.invitationId}:{emailSendCount:0}),...(selection.importId?{rosterRows:{some:{importId:selection.importId,status:"INVITATION_CREATED"}}}:{} )},orderBy:{id:"asc"},take:51,select:{id:true}});
 if(!rows.length||rows.length>50)throw Error("Select between one and 50 pending invitations. Use smaller imports or individual invitations.");
 return rows.map(r=>r.id);
}
export async function previewInvitationSchedule(input:unknown){
 const selection=invitationScheduleSelection.parse(input),{user}=await requireClubPermission(selection.clubId,["members.manage"]);
 return clubWriteTransaction(async tx=>{const ids=await targets(tx,selection);await validateScheduledInvitations(tx,selection.clubId,user.id,ids,new Date());return {count:ids.length};});
}
export async function saveInvitationSchedule(input:unknown){
 const d=invitationScheduleInput.parse(input),clubId=d.selection.clubId,scheduledAt=resolveScheduleTime(d.localTime,d.timeZone,d.occurrence),{user}=await requireClubPermission(clubId,["members.manage"]);
 if(await supportContext())throw Error("Exit support impersonation before scheduling future email.");
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,clubId,user.id,["members.manage"]);
  const previous=await tx.scheduledCommunication.findUnique({where:{id:d.id}}),body=JSON.stringify(d);
  if(previous){if(previous.clubId===clubId&&previous.senderId===user.id&&previous.kind==="INVITATION_EMAIL"&&previous.body===body)return {id:previous.id,status:previous.status};throw Error("Schedule identifier already used.");}
  requireFutureSchedule(scheduledAt);
  if(await tx.scheduledCommunication.count({where:{clubId,status:{in:["SCHEDULED","PROCESSING","FAILED"]}}})>=100)throw Error("Cancel unused scheduled work first.");
  const ids=await targets(tx,d.selection),rows=await validateScheduledInvitations(tx,clubId,user.id,ids,scheduledAt);
  const snapshot={targets:rows.map(r=>({id:r.id,fingerprint:invitationFingerprint(r)}))};
  await tx.scheduledCommunication.create({data:{id:d.id,clubId,senderId:user.id,actorId:user.id,kind:"INVITATION_EMAIL",title:`Invitation emails · ${rows.length}`,body,audience:{},snapshot:snapshot as Prisma.InputJsonValue,recipientMode:"FIXED",scheduledAt,timeZone:d.timeZone,localTime:d.localTime,occurrence:d.occurrence,requestKey:d.id}});
  await tx.auditLog.create({data:{actorId:user.id,clubId,targetId:d.id,action:"communication.invitation.schedule",details:{count:rows.length,scheduledAt:scheduledAt.toISOString()}}});
  return {id:d.id,status:"SCHEDULED" as const};
 });
}
export async function getInvitationSchedules(clubId:string){
 z.string().uuid().parse(clubId);const {user}=await requireClubPermission(clubId,["members.manage"]);
 return clubWriteTransaction(async tx=>{await authorizeClubTransaction(tx,clubId,user.id,["members.manage"],{readOnly:true});const select={id:true,title:true,status:true,revision:true,scheduledAt:true,timeZone:true,recipientCount:true} as const;const queued=await tx.scheduledCommunication.findMany({where:{clubId,kind:"INVITATION_EMAIL",status:{in:["SCHEDULED","PROCESSING","FAILED"]}},orderBy:{scheduledAt:"asc"},take:100,select});const history=await tx.scheduledCommunication.findMany({where:{clubId,kind:"INVITATION_EMAIL",status:{in:["PUBLISHED","CANCELLED"]}},orderBy:{updatedAt:"desc"},take:50,select});return [...queued,...history];});
}
export async function cancelInvitationSchedule(clubId:string,id:string,revision:number){
 z.string().uuid().parse(clubId);z.string().uuid().parse(id);z.number().int().nonnegative().parse(revision);const {user}=await requireClubPermission(clubId,["members.manage"]);
 return clubWriteTransaction(async tx=>{await authorizeClubTransaction(tx,clubId,user.id,["members.manage"]);const row=await tx.scheduledCommunication.findFirst({where:{id,clubId,kind:"INVITATION_EMAIL"}});if(!row)throw Error("Scheduled invitation unavailable.");if(row.status==="CANCELLED"&&row.revision===revision+1)return {cancelled:true};if(row.revision!==revision||!["SCHEDULED","FAILED"].includes(row.status))throw Error("Schedule changed or processing. Refresh before cancelling.");await tx.scheduledCommunication.update({where:{id},data:{status:"CANCELLED",revision:{increment:1},failureCode:null}});await tx.auditLog.create({data:{actorId:user.id,clubId,targetId:id,action:"communication.invitation.cancel"}});return {cancelled:true};});
}
