"use server";
import {isGraduatedMember} from "@/lib/graduation";
import {readVotingRules} from "@/lib/voting-rules";
import { votingReadLimits } from "@/lib/voting-transaction-limits";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { clubWriteTransaction, votingWriteLimits } from "@/utils/club-write-transaction";
import { hasPermission, activeMemberWhere } from "@/lib/permissions";
import { interviewCapabilities } from "@/lib/interview-access";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";
import { liveRoomFields, roomScope, isOpenElectorate, MAX_ROOM_VOTERS } from "@/lib/voting-room";
import { alumniRefusal } from "@/utils/graduation";
import { supportContext } from "@/utils/support-audit";
import { allowedByProfileCeiling, normalizeProfileFieldVisibility } from "@/lib/profile-field-visibility";
import { loadVotingRoom, roomAuthority } from "@/utils/voting-room";
import { votingHighlightChoices } from "@/utils/voting-room-presentation";
import { CLUB_SUSPENDED_MESSAGE } from "@/lib/club-suspension";
import { joinMeetingPreview } from "@/lib/voting-session-setup";

export async function getLiveVotingSetup(input:unknown){
  const d=z.object({clubId:z.string().uuid(),cycleId:z.string().uuid().optional(),roundId:z.string().uuid().optional()}).strict().parse(input);
  const {user}=await requireClubPermission(d.clubId,["applications.review","decisions.manage","decisions.start"]);
  return prisma.$transaction(async tx=>{
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.manage","decisions.start"],{readOnly:true});
    const cycles=await tx.recruitmentCycle.findMany({where:{clubId:d.clubId,archivedAt:null},select:{id:true,name:true},orderBy:{createdAt:"desc"}});
    const roundRows=await tx.pipelineRound.findMany({where:{clubId:d.clubId,archivedAt:null},select:{id:true,name:true,type:true,anonymousReview:true,club:{select:{profileFieldVisibility:true}}},orderBy:{order:"asc"}});
    // The club's applicant profile setting is the ceiling for slide fields (read with the rounds, same snapshot).
    const profileFields=normalizeProfileFieldVisibility(roundRows[0]?.club?.profileFieldVisibility);
    const rounds=roundRows.map(({club:_club,...r})=>r);
    const round=rounds.find(r=>r.id===d.roundId),cycle=cycles.find(c=>c.id===d.cycleId);
    if(d.roundId&&!round||d.cycleId&&!cycle)throw Error("The selected cycle or round is unavailable in this club.");
    if(round&&!round.anonymousReview&&!hasPermission(m,"applicants.identify"))throw Error("Identified review permission required.");
    const apps=round&&cycle?await tx.application.findMany({where:{clubId:d.clubId,roundId:round.id,recruitmentCycleId:cycle.id,status:{in:["SUBMITTED","IN_REVIEW","INTERVIEWING","WAITLISTED"]}},select:{id:true,student:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}},orderBy:[{submittedAt:"asc"},{id:"asc"}]}):[];
    // Count only: any of these members can join with the join QR or link (no saved voter list).
    const members=await tx.clubMember.findMany({where:{clubId:d.clubId,...activeMemberWhere,user:{disabledAt:null}},select:{status:true,alumniSince:true,isOwner:true,permissions:true,user:{select:{studentProfile:{select:{graduatedAt:true}}}}}});
    const joinableVoterCount=members.filter(v=>!isGraduatedMember(v)&&hasPermission(v,"applications.review")&&hasPermission(v,"decisions.vote")&&(!round||round.anonymousReview||hasPermission(v,"applicants.identify"))).length;
    const evidence=interviewCapabilities(m);
    const ownReview=await tx.interviewRecord.findFirst({where:{interviewerId:m.id,completedAt:{not:null},application:{clubId:d.clubId}},select:{id:true}});
    const panel=await tx.interviewPanelAssignment.findFirst({where:{memberId:m.id,revokedAt:null,application:{clubId:d.clubId}},select:{id:true}});
    const permittedFields=liveRoomFields.filter(f=>!(round?.anonymousReview&&["name","photo","major","resumeHighlight","interviewScore","finalInterviewThoughts","additionalObservations"].includes(f))&&(f!=="resumeHighlight"||evidence.moderateResume||!!panel)&&(!["interviewScore","finalInterviewThoughts"].includes(f)||evidence.readClosing||!!ownReview));
    const allowedFields=permittedFields.filter(f=>allowedByProfileCeiling(f,profileFields));
    const hiddenProfileFields=permittedFields.filter(f=>!allowedByProfileCeiling(f,profileFields));
    const ruleRows=await tx.votingRuleDefault.findMany({where:{clubId:d.clubId,OR:[{roundId:null},...(round?[{roundId:round.id}]:[])]}});
    const ruleRow=ruleRows.find(r=>round&&r.roundId===round.id)??ruleRows.find(r=>r.roundId===null);
    return {memberId:m.id,timeZone:"America/New_York",cycles,rounds,allowedFields,hiddenProfileFields,canEditProfileFields:hasPermission(m,"club.settings"),defaultRules:readVotingRules(ruleRow?.rules),defaultRulesSource:ruleRow?(ruleRow.roundId?"round" as const:"club" as const):null,applicants:apps.map(a=>({id:a.id,label:round?.anonymousReview?anonymousApplicantLabel(a.id):a.student.studentProfile?`${a.student.studentProfile.firstName} ${a.student.studentProfile.lastName}`:"Applicant"})),joinableVoterCount};
  },votingReadLimits);
}

export async function getVotingHighlightOptions(input:unknown){
  const d=z.object({clubId:z.string().uuid(),applicationId:z.string().uuid(),roundId:z.string().uuid(),cycleId:z.string().uuid()}).strict().parse(input);
  const {user}=await requireClubPermission(d.clubId,["applications.review","decisions.manage","decisions.start"]);
  return prisma.$transaction(async tx=>{
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.manage","decisions.start"],{readOnly:true});
    const app=await tx.application.findFirst({where:{id:d.applicationId,clubId:d.clubId,roundId:d.roundId,recruitmentCycleId:d.cycleId,status:{not:"DRAFTING"}},include:{round:true}});
    if(!app||app.round.anonymousReview||!hasPermission(m,"applicants.identify"))return [];
    return votingHighlightChoices(tx,d.clubId,app.id,user.id);
  },votingReadLimits);
}

/** Authenticated, generic denial: knowing UUIDs never reveals a club or candidate. */
export async function getLiveVotingJoinInfo(input:unknown){
  const d=roomScope.parse(input);const {user}=await requireAuth();
  return prisma.$transaction(async tx=>{
    let m;try{m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.vote"],{readOnly:true});}catch(e){if(e instanceof Error&&(e.message.startsWith("Club access denied.")||e.message===CLUB_SUSPENDED_MESSAGE))return {status:"DENIED" as const};throw e;}
    const session=await tx.votingSession.findFirst({where:{id:d.sessionId,clubId:d.clubId,mode:"LIVE"},select:{id:true}});
    if(!session)return {status:"EXPIRED" as const};
    const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId);
    const cycle=await tx.recruitmentCycle.findFirst({where:{id:s.cycleId!,clubId:d.clubId},select:{archivedAt:true}});
    if(round.archivedAt||cycle?.archivedAt)return {status:"EXPIRED" as const};
    try{if(!roomAuthority(s,m,round.anonymousReview).voter)return {status:"DENIED" as const};}catch{return {status:"DENIED" as const};}
    if(await alumniRefusal(tx,user.id,"vote"))return {status:"DENIED" as const};
    if(s.state==="COMPLETED"||s.finalizedAt)return {status:"ENDED" as const};
    const meeting=joinMeetingPreview((s.presentationOptions as {meeting?:unknown}|null)?.meeting,s.state==="DRAFT"&&!s.startedAt);
    return {status:s.participants.find(p=>p.memberId===m.id)?.joinedAt?"JOINED" as const:"READY" as const,meeting};
  },votingReadLimits);
}
export async function joinLiveVotingRoom(input:unknown){
  const d=roomScope.parse(input),{user}=await requireClubPermission(d.clubId,["applications.review","decisions.vote"]);
  return clubWriteTransaction(async tx=>{
    // Current membership in this session's club (and so its school), an enabled account and the club's voting
    // permissions; alumni are refused (lib/graduation.ts). The session row lock serializes joins with a ballot closing.
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.vote"]);
    // A support session acts as the member but never joins a vote for them.
    if(await supportContext())throw Error("Joining a vote isn’t available in a support session.");
    if(await alumniRefusal(tx,user.id,"vote"))throw Error("Session ended or joining is unavailable.");
    const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId,true);
    if(!roomAuthority(s,m,round.anonymousReview).voter||s.state==="COMPLETED"||s.finalizedAt)throw Error("Session ended or joining is unavailable.");
    const p=s.participants.find(p=>p.memberId===m.id);
    if(!p){
      // Open electorate only (a legacy session's voter is always on its saved list): joining adds the member, at any time.
      if(!isOpenElectorate(s.presentationOptions))throw Error("Session ended or joining is unavailable.");
      if(s.participants.length>=MAX_ROOM_VOTERS)throw Error(`This session is full (${MAX_ROOM_VOTERS} voters).`);
      await tx.votingParticipant.create({data:{sessionId:s.id,memberId:m.id,joinedAt:new Date()}});
      await tx.votingSession.update({where:{id:s.id},data:{revision:{increment:1}}});
      await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:"voting.room.joined",details:{memberId:m.id,late:!!s.startedAt}}});
    }else if(!p.joinedAt){
      await tx.votingParticipant.update({where:{sessionId_memberId:{sessionId:s.id,memberId:m.id}},data:{joinedAt:new Date()}});
      await tx.votingSession.update({where:{id:s.id},data:{revision:{increment:1}}});
      await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:s.id,action:"voting.room.joined",details:{memberId:m.id}}});
    }
    return {joined:true};
  },votingWriteLimits);
}

/** Resolve only currently authorized, eligible IDs; never disclose foreign applicants. */
export async function resolveLiveVotingSelection(input:unknown){
 const {votingSelectionSchema,selectionScopes}=await import("@/lib/voting-navigation");
 const d=votingSelectionSchema.parse(input);if(new Set(d.applicationIds).size!==d.applicationIds.length)throw Error("Duplicate applicant selection.");
 const {user}=await requireClubPermission(d.clubId,["applications.review","decisions.manage","decisions.start"]);
 return prisma.$transaction(async tx=>{
  const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.manage","decisions.start"],{readOnly:true});
  const rows=await tx.application.findMany({where:{clubId:d.clubId,id:{in:d.applicationIds},round:{archivedAt:null,...(!hasPermission(m,"applicants.identify")?{anonymousReview:true}:{})},recruitmentCycle:{archivedAt:null}},select:{id:true,roundId:true,recruitmentCycleId:true,status:true,round:{select:{name:true}},recruitmentCycle:{select:{name:true}}}});
  return selectionScopes(rows,d.applicationIds);
 },votingReadLimits);
}
