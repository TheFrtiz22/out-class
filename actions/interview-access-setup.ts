"use server";

import { lockOperationalClub } from "@/lib/club-suspension";
import { roomPanelApprovalSchema, roomPanelChangeSchema } from "@/lib/interview-setup";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { interviewActor } from "@/utils/interview-access";
import { syncBookingPanel } from "@/utils/interview-scheduling-access";
import { interviewCapabilities } from "@/lib/interview-access";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";
import { overlaps } from "@/lib/interview-rooms";
const id=z.string().uuid();
export async function getInterviewAccessSetup(clubId: string) {
  id.parse(clubId); const { user }=await requireAuth({verifyEmail:true});
  return prisma.$transaction(async tx=>{
    const {caps}=await interviewActor(tx,clubId,user.id);if(!caps.manageGrants)throw Error("Owner interview-access management required.");
    const members=await tx.clubMember.findMany({where:{clubId,status:"ACTIVE",user:{disabledAt:null}},include:{user:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}});
    const applications=await tx.application.findMany({where:{clubId,status:{not:"DRAFTING"},studentId:{not:user.id}},select:{id:true,status:true,roundId:true,round:{select:{name:true,anonymousReview:true}},student:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}});
    const rooms=await tx.interviewRoom.findMany({where:{clubId},include:{slots:{include:{bookings:{select:{id:true,applicationId:true,roundId:true}}}}},orderBy:{createdAt:"desc"}});
    const grants=await tx.interviewPanelAssignment.findMany({where:{application:{clubId}},select:{id:true,applicationId:true,roundId:true,memberId:true,revokedAt:true,bookingManaged:true}});
    return {members:members.map(m=>({id:m.id,name:m.user.studentProfile?`${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}`:"Member",offices:m.interviewOffices,participate:interviewCapabilities(m).participate})),applications:applications.map(a=>({id:a.id,roundId:a.roundId,roundName:a.round.name,anonymous:a.round.anonymousReview,name:a.round.anonymousReview?anonymousApplicantLabel(a.id):a.student.studentProfile?`${a.student.studentProfile.firstName} ${a.student.studentProfile.lastName}`:"Profile not provided"})),rooms:rooms.map(r=>({id:r.id,name:r.name,roundId:r.roundId,isOpen:r.isOpen,panelMemberIds:r.panelMemberIds,approvedPanelMemberIds:r.approvedPanelMemberIds,revision:r.panelApprovalRevision,bookings:r.slots.flatMap(s=>s.bookings).map(b=>({id:b.id,applicationId:b.applicationId,unresolved:!applications.some(a=>a.id===b.applicationId&&a.roundId===r.roundId&&a.status==="INTERVIEWING"&&!a.round.anonymousReview)||b.roundId!==r.roundId}))})),grants};
  });
}
export async function approveInterviewRoomPanel(input: unknown) {
  const data=roomPanelApprovalSchema.parse(input);const {user}=await requireAuth({verifyEmail:true});
  return prisma.$transaction(async tx=>{
    await lockOperationalClub(tx, data.clubId);
    const {caps}=await interviewActor(tx,data.clubId,user.id);if(!caps.manageGrants)throw Error("Only an owner can approve panel access.");
    const room=await tx.interviewRoom.findFirst({where:{id:data.roomId,clubId:data.clubId},include:{round:true,slots:{include:{bookings:true}}}});
    if(!room||!room.isOpen||room.round.anonymousReview||room.panelApprovalRevision!==data.revision||JSON.stringify([...room.panelMemberIds].sort())!==JSON.stringify([...new Set(data.panelMemberIds)].sort()))throw Error("Room panel changed or requires identified-round review. Refresh before approval.");
    const members=await tx.clubMember.findMany({where:{id:{in:room.panelMemberIds},clubId:data.clubId,status:"ACTIVE",user:{disabledAt:null}}});
    if(members.length!==room.panelMemberIds.length||members.some(m=>!interviewCapabilities(m).participate))throw Error("Every approved panel member must be an active identified reviewer.");
    const changed=await tx.interviewRoom.updateMany({where:{id:room.id,panelApprovalRevision:data.revision},data:{approvedPanelMemberIds:room.panelMemberIds,panelApprovedBy:user.id,panelApprovalRevision:{increment:1}}});if(changed.count!==1)throw Error("Room panel changed.");
    let unresolved=0;
    for(const booking of room.slots.flatMap(s=>s.bookings)) {
      const app=await tx.application.findFirst({where:{id:booking.applicationId,clubId:data.clubId}});
      if(!app||booking.roundId!==room.roundId||app.roundId!==room.roundId||app.status!=="INTERVIEWING"){unresolved++;continue;}
      await tx.$queryRaw`SELECT id FROM "Application" WHERE id=${app.id} FOR UPDATE`;
      await syncBookingPanel(tx,app.id,room.roundId,user.id);
    }
    await tx.auditLog.create({data:{actorId:user.id,clubId:data.clubId,targetId:room.id,action:"interview.room.panel.approve",details:{members:room.panelMemberIds,revision:data.revision,unresolved}}});return{unresolved};
  });
}
export async function changeInterviewRoomPanel(input: unknown) {
  const data=roomPanelChangeSchema.parse(input);const {user}=await requireAuth();
  return prisma.$transaction(async tx=>{
    await lockOperationalClub(tx, data.clubId);
    const {member}=await interviewActor(tx,data.clubId,user.id);
    if(!member.isOwner&&!member.permissions.includes("interviews.manage"))throw Error("Scheduling access required.");
    const room=await tx.interviewRoom.findFirst({where:{id:data.roomId,clubId:data.clubId}});if(!room||room.panelApprovalRevision!==data.revision)throw Error("Room panel changed.");
    const ids=[...new Set(data.panelMemberIds)];if(await tx.clubMember.count({where:{id:{in:ids},clubId:data.clubId,status:"ACTIVE",user:{disabledAt:null}}})!==ids.length)throw Error("Choose active club members.");
    const slots=await tx.interviewSlot.findMany({where:{roomId:room.id,startTime:{gt:new Date()}}});
    const others=await tx.interviewSlot.findMany({where:{clubId:data.clubId,roomId:{not:room.id},OR:[{room:{isOpen:true}},{bookings:{some:{}}}]},include:{room:true}});
    if(slots.some(s=>others.some(o=>o.room?.panelMemberIds.some(memberId=>ids.includes(memberId))&&overlaps(s,o,Math.max(room.buffer,o.room?.buffer??0)))))throw Error("An interviewer already has an overlapping room schedule.");
    // Any edit invalidates owner approval; it never grants private access.
    await tx.interviewRoom.update({where:{id:room.id},data:{panelMemberIds:ids,approvedPanelMemberIds:[],panelApprovedBy:null,panelApprovalRevision:{increment:1}}});
    await tx.auditLog.create({data:{actorId:user.id,clubId:data.clubId,targetId:room.id,action:"interview.room.panel.change",details:{before:room.panelMemberIds,after:ids}}});
  });
}
