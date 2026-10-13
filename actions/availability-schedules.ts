"use server";
import {z} from "zod";
import {Prisma} from "@prisma/client";
import {requireClubPermission} from "@/utils/auth";
import {supportContext} from "@/utils/support-audit";
import {clubWriteTransaction} from "@/utils/club-write-transaction";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
import {resolveScheduleTime,requireFutureSchedule} from "@/lib/communication-schedule";
import {availabilityScheduleInput} from "@/lib/availability-schedule";
import {loadInterviewerPool} from "@/utils/interviewer-pool";
import {activeAvailabilityRound} from "@/utils/availability-publication";
export async function saveAvailabilitySchedule(input:unknown){
 const d=availabilityScheduleInput.parse(input),{clubId,roundId}=d.scope,scheduledAt=resolveScheduleTime(d.localTime,d.timeZone,d.occurrence),{user}=await requireClubPermission(clubId,["interviews.manage"]);
 if(await supportContext())throw Error("Exit support impersonation before scheduling future communications.");
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,clubId,user.id,["interviews.manage"]);
  const old=await tx.scheduledCommunication.findUnique({where:{id:d.id}}),body=JSON.stringify(d);
  if(old){if(old.clubId===clubId&&old.senderId===user.id&&old.kind==="AVAILABILITY_REQUEST"&&old.body===body)return {id:old.id,status:old.status};throw Error("Schedule identifier already used.");}
  requireFutureSchedule(scheduledAt);
  if(await tx.scheduledCommunication.count({where:{clubId,status:{in:["SCHEDULED","PROCESSING","FAILED"]}}})>=100)throw Error("Cancel unused scheduled work first.");
  await activeAvailabilityRound(tx,clubId,roundId);const pool=await loadInterviewerPool(tx,clubId,roundId,d.scope.memberIds);
  if(pool.members.length!==d.scope.memberIds.length||pool.members.some(m=>!m.eligible||m.disabledAt))throw Error("Select eligible current interviewers.");
  await tx.scheduledCommunication.create({data:{id:d.id,clubId,senderId:user.id,actorId:user.id,kind:"AVAILABILITY_REQUEST",title:`Availability ${d.scope.reminder?"reminders":"requests"} · ${pool.members.length}`,body,audience:{},snapshot:d.scope as Prisma.InputJsonValue,recipientMode:"FIXED",scheduledAt,timeZone:d.timeZone,localTime:d.localTime,occurrence:d.occurrence,requestKey:d.id}});
  await tx.auditLog.create({data:{actorId:user.id,clubId,targetId:d.id,action:"communication.availability.schedule",details:{roundId,count:pool.members.length,scheduledAt:scheduledAt.toISOString()}}});return {id:d.id,status:"SCHEDULED" as const};
 });
}
export async function getAvailabilitySchedules(clubId:string){
 z.string().uuid().parse(clubId);const {user}=await requireClubPermission(clubId,["interviews.manage"]);
 return clubWriteTransaction(async tx=>{await authorizeClubTransaction(tx,clubId,user.id,["interviews.manage"],{readOnly:true});const select={id:true,title:true,status:true,revision:true,scheduledAt:true,timeZone:true,recipientCount:true} as const;return [...await tx.scheduledCommunication.findMany({where:{clubId,kind:"AVAILABILITY_REQUEST",status:{in:["SCHEDULED","PROCESSING","FAILED"]}},orderBy:{scheduledAt:"asc"},take:100,select}),...await tx.scheduledCommunication.findMany({where:{clubId,kind:"AVAILABILITY_REQUEST",status:{in:["PUBLISHED","CANCELLED"]}},orderBy:{updatedAt:"desc"},take:50,select})];});
}
export async function cancelAvailabilitySchedule(clubId:string,id:string,revision:number){
 z.string().uuid().parse(clubId);z.string().uuid().parse(id);z.number().int().nonnegative().parse(revision);const {user}=await requireClubPermission(clubId,["interviews.manage"]);
 return clubWriteTransaction(async tx=>{await authorizeClubTransaction(tx,clubId,user.id,["interviews.manage"]);const row=await tx.scheduledCommunication.findFirst({where:{id,clubId,kind:"AVAILABILITY_REQUEST"}});if(!row)throw Error("Schedule unavailable.");if(row.status==="CANCELLED"&&row.revision===revision+1)return {cancelled:true};if(row.revision!==revision||!["SCHEDULED","FAILED"].includes(row.status))throw Error("Schedule changed or processing.");await tx.scheduledCommunication.update({where:{id},data:{status:"CANCELLED",revision:{increment:1},failureCode:null}});await tx.auditLog.create({data:{actorId:user.id,clubId,targetId:id,action:"communication.availability.cancel"}});return {cancelled:true};});
}
