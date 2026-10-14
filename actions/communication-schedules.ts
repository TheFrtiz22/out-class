"use server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { scheduleInput, resolveScheduleTime, requireFutureSchedule } from "@/lib/communication-schedule";
import { audienceKey } from "@/lib/recipient-audience";
import { requireClubPermission } from "@/utils/auth";
import { supportContext } from "@/utils/support-audit";
import { clubWriteTransaction } from "@/utils/club-write-transaction";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { captureRecipientAudience } from "@/utils/recipient-audience";

const uuid=z.string().uuid();
export async function saveCommunicationSchedule(input: unknown) {
 const data=scheduleInput.parse(input);
 const scheduledAt=resolveScheduleTime(data.localTime,data.timeZone,data.occurrence);
 const {user}=await requireClubPermission(data.clubId,["meetings.manage"]);
 // A temporary support session must not mint authority that outlives that session.
 if(await supportContext()) throw Error("Exit support impersonation before scheduling a future publication.");
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,data.clubId,user.id,["meetings.manage"]);
  const previous=await tx.scheduledCommunication.findFirst({where:{id:data.id,clubId:data.clubId,kind:"ANNOUNCEMENT"}});
  if(previous && previous.senderId!==user.id) throw Error("Only the sender can edit this scheduled send.");
  const values={title:data.title,body:data.body,audience:data.audience,recipientMode:data.recipientMode,scheduledAt,timeZone:data.timeZone,localTime:data.localTime,occurrence:data.occurrence};
  // Response-loss retries do not recapture a fixed snapshot or increment revision.
  if(previous && previous.status==="SCHEDULED" && audienceKey({title:previous.title,body:previous.body,audience:previous.audience,recipientMode:previous.recipientMode,scheduledAt:previous.scheduledAt.toISOString(),timeZone:previous.timeZone,localTime:previous.localTime,occurrence:previous.occurrence})===audienceKey({...values,scheduledAt:scheduledAt.toISOString()}) && previous.revision===(data.revision===null?0:data.revision+1)) return {id:previous.id,revision:previous.revision,scheduledAt:previous.scheduledAt};
  requireFutureSchedule(scheduledAt);
  if(previous && (previous.revision!==data.revision || !["SCHEDULED","FAILED"].includes(previous.status))) throw Error("Scheduled send changed or already published. Refresh before editing.");
  if(!previous && data.revision!==null) throw Error("Scheduled send unavailable.");
  if(!previous && await tx.scheduledCommunication.count({where:{clubId:data.clubId,status:{in:["SCHEDULED","PROCESSING","FAILED"]}}})>=100) throw Error("This club has 100 queued sends. Cancel unused sends first.");
  const snapshot=await captureRecipientAudience(tx,data.clubId,user.id,data.audience);
  if(!snapshot.userIds.length) throw Error("No eligible recipients for this audience.");
  const json=snapshot as unknown as Prisma.InputJsonValue;
  const saved=previous?await tx.scheduledCommunication.update({where:{id:previous.id},data:{...values,snapshot:json,revision:{increment:1},status:"SCHEDULED",failureCode:null}}):await tx.scheduledCommunication.create({data:{...values,id:data.id,clubId:data.clubId,senderId:user.id,actorId:user.id,requestKey:data.id,snapshot:json}});
  await tx.auditLog.create({data:{actorId:user.id,clubId:data.clubId,targetId:saved.id,action:"communication.schedule.save",details:{revision:saved.revision,recipientMode:data.recipientMode,scheduledAt:scheduledAt.toISOString(),count:snapshot.userIds.length}}});
  return {id:saved.id,revision:saved.revision,scheduledAt:saved.scheduledAt};
 });
}
export async function getCommunicationSchedules(clubId:string) {
 uuid.parse(clubId);const {user}=await requireClubPermission(clubId,["meetings.manage"]);
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,clubId,user.id,["meetings.manage"],{readOnly:true});
  // Snapshot identities stay server-only. Managers may inspect content/status, only sender edits.
  const select={id:true,senderId:true,title:true,body:true,audience:true,recipientMode:true,scheduledAt:true,timeZone:true,localTime:true,occurrence:true,status:true,revision:true,publicationId:true,recipientCount:true,failureCode:true} as const;
  const queued=await tx.scheduledCommunication.findMany({where:{clubId,kind:"ANNOUNCEMENT",status:{in:["SCHEDULED","PROCESSING","FAILED"]}},orderBy:{scheduledAt:"asc"},take:100,select});
  const history=await tx.scheduledCommunication.findMany({where:{clubId,kind:"ANNOUNCEMENT",status:{in:["PUBLISHED","CANCELLED"]}},orderBy:{updatedAt:"desc"},take:50,select});
  const rows=[...queued,...history];
  const publicationIds=history.flatMap(row=>row.publicationId?[row.publicationId]:[]);
  const emailRows=publicationIds.length?await tx.$queryRaw<{announcementId:string;outboxStatus:string;deliveryStatus:string|null;count:number}[]>`
    SELECT n."announcementId",o.status AS "outboxStatus",d.status AS "deliveryStatus",COUNT(*)::int AS count
    FROM "UserNotification" n JOIN "NotificationEmailOutbox" o ON o."notificationId"=n.id
    LEFT JOIN "NotificationEmailDelivery" d ON d.id=o."deliveryId"
    WHERE n."clubId"=${clubId} AND n."announcementId"=ANY(${publicationIds}::text[])
    GROUP BY n."announcementId",o.status,d.status`:[];
  return rows.map(row=>{
   const email={queued:0,sent:0,suppressed:0,attention:0};
   for(const item of emailRows.filter(item=>item.announcementId===row.publicationId)){
    if(item.outboxStatus==="SUPPRESSED"||item.deliveryStatus==="SUPPRESSED")email.suppressed+=item.count;
    else if(item.deliveryStatus==="SENT")email.sent+=item.count;
    else if(item.deliveryStatus==="FAILED"||item.deliveryStatus==="UNCERTAIN")email.attention+=item.count;
    else email.queued+=item.count;
   }
   return {...row,canEdit:row.senderId===user.id,email};
  });
 });
}
export async function cancelCommunicationSchedule(clubId:string,id:string,revision:number) {
 uuid.parse(clubId);uuid.parse(id);z.number().int().nonnegative().parse(revision);
 const {user}=await requireClubPermission(clubId,["meetings.manage"]);
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,clubId,user.id,["meetings.manage"]);
  const row=await tx.scheduledCommunication.findFirst({where:{id,clubId,kind:"ANNOUNCEMENT"}});
  if(!row) throw Error("Scheduled send unavailable.");
  if(row.status==="CANCELLED"&&row.revision===revision+1) return {cancelled:true};
  if(row.revision!==revision||!["SCHEDULED","FAILED"].includes(row.status)) throw Error("Scheduled send changed or already published. Refresh before cancelling.");
  await tx.scheduledCommunication.update({where:{id},data:{status:"CANCELLED",revision:{increment:1},failureCode:null}});
  await tx.auditLog.create({data:{actorId:user.id,clubId,targetId:id,action:"communication.schedule.cancel",details:{revision}}});
  return {cancelled:true};
 });
}
